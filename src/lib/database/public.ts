import 'server-only';
import { createDatabase } from './client';

/** Only published-content views are exposed, under the database's anonymous role. */
export function publicDatabase() {
  const url = process.env.DATABASE_URL;
  return url ? createDatabase(url, 'public') : null;
}
