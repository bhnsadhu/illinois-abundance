import { administrativeClient } from './database';
import { sampleTopics, sampleWriters, samplePosts, sampleEvents, sampleLearnPages, sampleMeetings } from '../src/lib/sample-data';

const db = administrativeClient();
const batches: [string, object[]][] = [['topics', sampleTopics]];
if (process.env.SEED_SAMPLE_CONTENT === 'true') {
  batches.push(
    ['writers', sampleWriters],
    ['posts', samplePosts.map(post => ({ ...post, status: 'published' }))],
    ['events', sampleEvents],
    ['learn_pages', sampleLearnPages],
    ['meetings', sampleMeetings],
  );
}
const admin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (!admin || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin)) {
  throw new Error('Set a valid ADMIN_EMAIL before seeding.');
}

// Table and column identifiers come only from the checked-in seed definitions.
function identifier(value: string) {
  if (!/^[a-z_]+$/.test(value)) throw new Error('Unexpected seed identifier.');
  return `"${value}"`;
}

try {
  await db.connect();
  await db.query('begin');
  try {
    for (const [table, rows] of batches) {
      let inserted = 0;
      for (const row of rows) {
        const entries = Object.entries(row);
        const columns = entries.map(([key]) => identifier(key)).join(',');
        const placeholders = entries.map((_, index) => `$${index + 1}`).join(',');
        const values = entries.map(([, value]) => value !== null && typeof value === 'object' ? JSON.stringify(value) : value);
        const result = await db.query(
          `insert into public.${identifier(table)} (${columns}) values (${placeholders}) on conflict (id) do nothing`,
          values,
        );
        inserted += result.rowCount ?? 0;
      }
      console.log(`Seeded ${table}: ${inserted} new rows; existing content preserved.`);
    }
    await db.query(`
      insert into public.reviewers(email,name,is_active) values($1,'Admin',true)
      on conflict(email) do update set is_active=true
    `, [admin]);
    await db.query('commit');
    console.log('Admin reviewer ready.');
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
} finally {
  await db.end();
}
