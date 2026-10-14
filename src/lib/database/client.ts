import 'server-only';
import { neon } from '@neondatabase/serverless';

export type DatabaseError = { code: string; message: string };
export type DatabaseResult<T> = { data: T | null; error: DatabaseError | null; count: number | null };
type Row = Record<string, unknown>;
type Statement = { text: string; values: unknown[] };
type QueryRows = { rows: Row[]; rowCount: number };
type Executor = (statements: Statement[], readOnly: boolean) => Promise<QueryRows[]>;
type SelectOptions = { count?: 'exact'; head?: boolean };
type UpsertOptions = { onConflict?: string; ignoreDuplicates?: boolean };
type OrderOptions = { ascending?: boolean; nullsFirst?: boolean };
type Filter = { column: string; operator: '=' | '<>' | '>=' | '<=' | '<' | '>' | 'IS' | 'IN'; value: unknown };

const publicViews = new Set([
  'public_posts', 'public_topics', 'public_story_topics', 'public_writers',
  'public_events', 'public_learn_pages', 'public_meetings', 'public_site_content',
]);

class InvalidQuery extends Error {
  constructor(message = 'Invalid database query.', readonly code = 'INVALID_QUERY') { super(message); }
}

function identifier(value: string): string {
  if (typeof value !== 'string' || !/^[a-z_][a-z0-9_]{0,62}$/.test(value)) throw new InvalidQuery('Invalid database identifier.');
  return `"${value}"`;
}

function columns(value: string, wildcard = true): string[] {
  if (wildcard && value === '*') return ['*'];
  if (typeof value !== 'string') throw new InvalidQuery('Invalid database projection.');
  const result = value.split(',').map(part => part.trim());
  if (!result.length || new Set(result).size !== result.length) throw new InvalidQuery('Invalid database projection.');
  result.forEach(identifier);
  return result;
}

function projection(value: string[]): string { return value.map(column => column === '*' ? '*' : identifier(column)).join(', '); }
function object(value: unknown): value is Row {
  return value !== null && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/** All application arrays/objects are JSONB; IN lists bind each scalar separately. */
function parameter(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date && Number.isFinite(value.valueOf())) return value.toISOString();
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (Array.isArray(value) || object(value)) return JSON.stringify(value);
  throw new InvalidQuery('Invalid database value.');
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalize(entry)]));
  return value;
}

function failure(error: unknown): DatabaseError {
  if (error instanceof InvalidQuery) return { code: error.code, message: error.message };
  const code = object(error) || error instanceof Error ? (error as { code?: unknown }).code : null;
  // PostgreSQL errors may include emails, complete row values, and credentials.
  return { code: typeof code === 'string' && /^[A-Z0-9]{5}$/.test(code) ? code : 'DATABASE_ERROR', message: 'The database request could not be completed.' };
}

function rejected<T>(error: unknown): DatabaseResult<T> { return { data: null, error: failure(error), count: null }; }
function integer(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new InvalidQuery('Invalid database pagination.');
  return value;
}

/** The deliberately small fluent API used by this application, backed by bound SQL. */
export class DatabaseQuery<T extends object = Row> implements PromiseLike<DatabaseResult<T[]>> {
  private operation: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private selected = ['*'];
  private returning = false;
  private options: SelectOptions = {};
  private filters: Filter[] = [];
  private ordering: { column: string; ascending: boolean; nullsFirst?: boolean }[] = [];
  private rowLimit?: number;
  private offset?: number;
  private records: Row[] = [];
  private conflict: string[] = ['id'];
  private ignoreDuplicates = false;
  private error?: unknown;
  private pending?: Promise<DatabaseResult<T[]>>;

  constructor(private readonly table: string, private readonly run: Executor, private readonly anonymous: boolean) {
    this.configure(() => {
      identifier(table);
      if (anonymous && !publicViews.has(table)) throw new InvalidQuery('This relation is not available publicly.', '42501');
    });
  }

  private configure(action: () => void): this {
    if (this.pending) throw new InvalidQuery('An executed query cannot be changed.');
    if (!this.error) {
      try { action(); } catch (error) { this.error = error; }
    }
    return this;
  }

  select(fields = '*', options: SelectOptions = {}): this {
    return this.configure(() => {
      this.selected = columns(fields);
      if (options.count !== undefined && options.count !== 'exact') throw new InvalidQuery('Unsupported database count.');
      this.options = options;
      this.returning = true;
    });
  }

  private filter(column: string, operator: Filter['operator'], value: unknown): this {
    return this.configure(() => {
      identifier(column);
      if (operator === 'IS' && value !== null && typeof value !== 'boolean') throw new InvalidQuery('IS filters require null or a boolean.');
      if (operator === 'IN' && !Array.isArray(value)) throw new InvalidQuery('IN filters require a list.');
      if (value === undefined) throw new InvalidQuery('Invalid database value.');
      this.filters.push({ column, operator, value });
    });
  }

  eq(column: string, value: unknown): this { return this.filter(column, '=', value); }
  neq(column: string, value: unknown): this { return this.filter(column, '<>', value); }
  gte(column: string, value: unknown): this { return this.filter(column, '>=', value); }
  lte(column: string, value: unknown): this { return this.filter(column, '<=', value); }
  lt(column: string, value: unknown): this { return this.filter(column, '<', value); }
  gt(column: string, value: unknown): this { return this.filter(column, '>', value); }
  is(column: string, value: null | boolean): this { return this.filter(column, 'IS', value); }
  in(column: string, values: readonly unknown[]): this { return this.filter(column, 'IN', values); }

  order(column: string, options: OrderOptions = {}): this {
    return this.configure(() => {
      identifier(column);
      this.ordering.push({ column, ascending: options.ascending !== false, nullsFirst: options.nullsFirst });
    });
  }

  limit(count: number): this { return this.configure(() => { this.rowLimit = integer(count); }); }
  range(from: number, to: number): this {
    return this.configure(() => {
      this.offset = integer(from);
      const end = integer(to);
      if (end < from) throw new InvalidQuery('Invalid database pagination.');
      this.rowLimit = integer(end - from + 1);
    });
  }

  private mutate(operation: 'insert' | 'upsert' | 'update' | 'delete', values?: unknown, options: UpsertOptions = {}): this {
    return this.configure(() => {
      if (this.anonymous) throw new InvalidQuery('Public database access is read only.', '42501');
      if (this.operation !== 'select') throw new InvalidQuery('A query can contain only one mutation.');
      this.operation = operation;
      if (operation === 'delete') return;
      const rows = Array.isArray(values) ? values : [values];
      if (!rows.length || (operation === 'update' && rows.length !== 1)) throw new InvalidQuery('Invalid database records.');
      this.records = rows.map(row => {
        if (!object(row)) throw new InvalidQuery('Invalid database record.');
        const entries = Object.entries(row).filter(([, value]) => value !== undefined);
        entries.forEach(([column]) => identifier(column));
        return Object.fromEntries(entries);
      });
      if (operation === 'upsert') {
        this.conflict = columns(options.onConflict ?? 'id', false);
        this.ignoreDuplicates = options.ignoreDuplicates === true;
      }
    });
  }

  insert(values: unknown): this { return this.mutate('insert', values); }
  upsert(values: unknown, options: UpsertOptions = {}): this { return this.mutate('upsert', values, options); }
  update(values: unknown): this { return this.mutate('update', values); }
  delete(): this { return this.mutate('delete'); }

  private where(values: unknown[]): string {
    const bind = (value: unknown) => { values.push(parameter(value)); return `$${values.length}`; };
    const filters = this.filters.map(({ column, operator, value }) => {
      const name = identifier(column);
      if (operator === 'IS') return `${name} IS ${value === null ? 'NULL' : value ? 'TRUE' : 'FALSE'}`;
      if (operator === 'IN') {
        const items = value as unknown[];
        return items.length ? `${name} IN (${items.map(bind).join(', ')})` : 'FALSE';
      }
      return `${name} ${operator} ${bind(value)}`;
    });
    return filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
  }

  private async execute(): Promise<DatabaseResult<T[]>> {
    if (this.error) return rejected(this.error);
    try {
      const relation = `"public".${identifier(this.table)}`;
      const fields = projection(this.selected);
      if (this.operation === 'select') {
        const filterValues: unknown[] = [];
        const where = this.where(filterValues);
        const statements: Statement[] = [];
        if (!this.options.head) {
          const values = [...filterValues];
          const bind = (value: number) => { values.push(value); return `$${values.length}`; };
          const order = this.ordering.length ? ` ORDER BY ${this.ordering.map(item => `${identifier(item.column)} ${item.ascending ? 'ASC' : 'DESC'}${item.nullsFirst === undefined ? '' : item.nullsFirst ? ' NULLS FIRST' : ' NULLS LAST'}`).join(', ')}` : '';
          const page = `${this.rowLimit === undefined ? '' : ` LIMIT ${bind(this.rowLimit)}`}${this.offset === undefined ? '' : ` OFFSET ${bind(this.offset)}`}`;
          statements.push({ text: `SELECT ${fields} FROM ${relation}${where}${order}${page}`, values });
        }
        if (this.options.count === 'exact' || this.options.head) {
          statements.push({ text: `SELECT COUNT(*) AS "__count" FROM ${relation}${where}`, values: filterValues });
        }
        const results = await this.run(statements, true);
        const count = this.options.count === 'exact' ? Number(results.at(-1)!.rows[0].__count) : null;
        return { data: this.options.head ? null : normalize(results[0].rows) as T[], error: null, count };
      }

      if (this.options.head || this.ordering.length || this.rowLimit !== undefined || this.offset !== undefined) throw new InvalidQuery('Mutation pagination and head requests are not supported.');
      const values: unknown[] = [];
      const bind = (value: unknown) => { values.push(parameter(value)); return `$${values.length}`; };
      let text: string;
      if (this.operation === 'insert' || this.operation === 'upsert') {
        if (this.filters.length) throw new InvalidQuery('Insert filters are not supported.');
        const keys = [...new Set(this.records.flatMap(row => Object.keys(row)))];
        if (!keys.length) {
          if (this.records.length !== 1) throw new InvalidQuery('Invalid empty database records.');
          text = `INSERT INTO ${relation} DEFAULT VALUES`;
        } else {
          const rows = this.records.map(row => `(${keys.map(key => Object.hasOwn(row, key) ? bind(row[key]) : 'DEFAULT').join(', ')})`);
          text = `INSERT INTO ${relation} (${keys.map(identifier).join(', ')}) VALUES ${rows.join(', ')}`;
        }
        if (this.operation === 'upsert') {
          const changes = keys.filter(key => !this.conflict.includes(key));
          text += ` ON CONFLICT (${this.conflict.map(identifier).join(', ')}) `;
          text += this.ignoreDuplicates || !changes.length ? 'DO NOTHING' : `DO UPDATE SET ${changes.map(key => `${identifier(key)} = EXCLUDED.${identifier(key)}`).join(', ')}`;
        }
      } else if (this.operation === 'update') {
        const entries = Object.entries(this.records[0]);
        if (!entries.length) throw new InvalidQuery('An update requires at least one field.');
        text = `UPDATE ${relation} SET ${entries.map(([key, value]) => `${identifier(key)} = ${bind(value)}`).join(', ')}${this.where(values)}`;
      } else text = `DELETE FROM ${relation}${this.where(values)}`;
      if (this.returning) text += ` RETURNING ${fields}`;
      const [result] = await this.run([{ text, values }], false);
      return { data: this.returning ? normalize(result.rows) as T[] : null, error: null, count: this.options.count === 'exact' ? result.rowCount : null };
    } catch (error) { return rejected(error); }
  }

  private result(): Promise<DatabaseResult<T[]>> { return this.pending ??= this.execute(); }

  then<TResult1 = DatabaseResult<T[]>, TResult2 = never>(
    onfulfilled?: ((value: DatabaseResult<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> { return this.result().then(onfulfilled, onrejected); }

  private async one(optional: boolean): Promise<DatabaseResult<T>> {
    const result = await this.result();
    if (result.error) return { ...result, data: null };
    const rows = result.data ?? [];
    if (rows.length === 1) return { ...result, data: rows[0] };
    if (!rows.length && optional) return { ...result, data: null };
    return rejected(new InvalidQuery('Expected one database record.', 'PGRST116'));
  }

  maybeSingle(): Promise<DatabaseResult<T>> { return this.one(true); }
  single(): Promise<DatabaseResult<T>> { return this.one(false); }
}

/** Server-only client. Anonymous reads always reduce privilege in the same transaction. */
export function createDatabase(connectionString: string, mode: 'service' | 'public' = 'service') {
  const sql = (() => {
    try { return neon(connectionString, { fullResults: true, fetchOptions: { cache: 'no-store' } }); }
    catch { throw new Error('The database connection could not be initialized.'); }
  })();
  const anonymous = mode === 'public';
  const run: Executor = async (statements, readOnly) => {
    if (anonymous || statements.length > 1) {
      const result = await sql.transaction(transaction => [
        ...(anonymous ? [transaction.query('SET LOCAL ROLE anon')] : []),
        ...statements.map(statement => transaction.query(statement.text, statement.values)),
      ], { fullResults: true, readOnly: anonymous || readOnly, isolationLevel: 'RepeatableRead', fetchOptions: { cache: 'no-store' } });
      return anonymous ? result.slice(1) : result;
    }
    return [await sql.query(statements[0].text, statements[0].values)];
  };
  return {
    from<T extends object = Row>(table: string) { return new DatabaseQuery<T>(table, run, anonymous); },
    async rpc<T = unknown>(name: string, args: Row = {}): Promise<DatabaseResult<T>> {
      try {
        if (anonymous && name !== 'search_public_posts') throw new InvalidQuery('This database function is not available publicly.', '42501');
        const functionName = identifier(name);
        if (!object(args)) throw new InvalidQuery('Invalid database function arguments.');
        const values: unknown[] = [];
        const parameters = Object.entries(args).map(([key, value]) => {
          const name = identifier(key);
          values.push(parameter(value));
          return `${name} => $${values.length}`;
        });
        const [result] = await run([{ text: `SELECT "public".${functionName}(${parameters.join(', ')}) AS "result"`, values }], anonymous);
        return { data: normalize(result.rows[0]?.result ?? null) as T | null, error: null, count: null };
      } catch (error) { return rejected(error); }
    },
  };
}

export type DatabaseClient = ReturnType<typeof createDatabase>;
