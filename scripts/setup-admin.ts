import { hashPassword } from '../src/lib/passwords';
import { emailSchema } from '../src/lib/validation';
import { administrativeClient } from './database';

// Supply once through the process environment, never through committed source.
const email = emailSchema.parse(process.env.ADMIN_EMAIL);
const password = process.env.ADMIN_INITIAL_PASSWORD;
if (!password) throw new Error('Provide ADMIN_INITIAL_PASSWORD for this command only.');
const hash = await hashPassword(password);
delete process.env.ADMIN_INITIAL_PASSWORD;
const reset = process.argv.includes('--reset');
const db = administrativeClient();
try {
  await db.connect();
  const result = await db.query(`
    insert into public.reviewers(email,name,is_active,password_hash) values($1,'Site admin',true,$2)
    on conflict(email) do update set password_hash=excluded.password_hash,is_active=true
    where reviewers.password_hash is null or $3
    returning id
  `, [email, hash, reset]);
  console.log(result.rowCount ? 'Admin password configured.' : 'Admin already has a password; existing credentials preserved.');
} finally { await db.end(); }
