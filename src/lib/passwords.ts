import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { passwordSchema } from './password-schema';

// Server/CLI only. OWASP's 32 MiB scrypt profile; never import into client UI.
const prefix = 'scrypt$32768$8$3';
const dummy = `${prefix}$${'0'.repeat(32)}$${'0'.repeat(128)}`;
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, Buffer.from(salt, 'hex'), 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => error ? reject(error) : resolve(key));
  });
}
export async function hashPassword(password: string): Promise<string> {
  passwordSchema.parse(password);
  const salt = randomBytes(16).toString('hex');
  return `${prefix}$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string | null | undefined): Promise<boolean> {
  if (typeof password !== 'string' || password.length > 128) return false;
  const valid = typeof encoded === 'string' && /^scrypt\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded);
  const parts = (valid ? encoded : dummy).split('$');
  const key = await derive(password, parts[4]);
  return timingSafeEqual(key, Buffer.from(parts[5], 'hex')) && valid;
}
