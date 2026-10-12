import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { administrativeClient } from './database';

const db = administrativeClient();
let locked = false;
try {
  await db.connect();
  // Keep the same direct session for the lock and every atomic migration.
  await db.query("select pg_advisory_lock(hashtextextended('illinois-abundance:migrations', 0))");
  locked = true;
  await db.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    );
    revoke all on public.schema_migrations from public;
    alter table public.schema_migrations enable row level security;
  `);
  const applied = new Map((await db.query<{ filename: string; checksum: string }>(
    'select filename, checksum from public.schema_migrations',
  )).rows.map(row => [row.filename, row.checksum]));
  const directory = new URL('../db/migrations/', import.meta.url);
  const files = (await readdir(directory)).filter(file => /^\d+_[a-z0-9_]+\.sql$/.test(file)).sort();
  let count = 0;
  for (const filename of files) {
    const sql = await readFile(new URL(filename, directory), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    if (applied.has(filename)) {
      if (applied.get(filename) !== checksum) throw new Error(`Applied migration changed: ${filename}. Add a new migration instead.`);
      continue;
    }
    await db.query('begin');
    try {
      await db.query(sql);
      await db.query('insert into public.schema_migrations(filename,checksum) values($1,$2)', [filename, checksum]);
      await db.query('commit');
      count++;
      console.log(`Applied ${filename}`);
    } catch (error) {
      await db.query('rollback');
      throw error;
    }
  }
  console.log(`Database is current. ${count} migration${count === 1 ? '' : 's'} applied.`);
} finally {
  if (locked) await db.query("select pg_advisory_unlock(hashtextextended('illinois-abundance:migrations', 0))").catch(() => {});
  await db.end();
}
