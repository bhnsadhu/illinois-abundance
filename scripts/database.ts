import { Client } from '@neondatabase/serverless';

/** Administrative scripts use a direct connection, never the transaction pooler. */
export function administrativeClient() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) throw new Error('Set DATABASE_URL_UNPOOLED before running database scripts.');
  if (new URL(connectionString).hostname.includes('-pooler')) {
    throw new Error('DATABASE_URL_UNPOOLED must be the direct Neon connection.');
  }
  return new Client({ connectionString, connectionTimeoutMillis: 15_000 });
}
