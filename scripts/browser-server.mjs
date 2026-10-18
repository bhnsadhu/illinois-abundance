import { spawn } from 'node:child_process';
import { readFile, readdir, utimes } from 'node:fs/promises';

// Never let browser tests load .env.local's live database, mail, or storage.
const env = {
  ...process.env,
  NODE_ENV: 'production',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3100',
  SEED_SAMPLE_CONTENT: 'true',
  DATABASE_URL: '', DATABASE_URL_UNPOOLED: '',
  RESEND_API_KEY: '', BLOB_READ_WRITE_TOKEN: '', MAIL_FROM: '',
  CODE_PEPPER: '', VIEW_SALT: '', ADMIN_EMAIL: '', SECOND_ADMIN_EMAIL: '',
};
let child;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child?.kill(signal));
function run(args) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', ...args], { env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Next exited with code ${code}`)));
  });
}
await run(['build']);
if (process.env.BROWSER_TEST_WARM_CACHE === 'true') {
  // Reproduce concurrent revalidation during a deployment with an existing cache.
  const directory = '.next/cache/fetch-cache';
  for (const file of await readdir(directory)) {
    const path = `${directory}/${file}`;
    const entry = JSON.parse(await readFile(path, 'utf8'));
    if (entry.tags?.includes('public-content')) await utimes(path, new Date(), new Date(Date.now() - 120_000));
  }
  await run(['build']);
}
await run(['start', '--hostname', '127.0.0.1', '--port', '3100']);
