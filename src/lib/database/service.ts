import 'server-only';
import { createDatabase } from './client';

/** Owner connection; callers must enforce authorization before accessing private data. */
export function serviceDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('The database is not connected yet. Please try again soon.');
  return createDatabase(url, 'service');
}
