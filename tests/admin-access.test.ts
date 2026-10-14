import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isAdminEmail } from '@/lib/admin-access';

beforeEach(() => {
  vi.stubEnv('ADMIN_EMAIL', 'owner@example.test');
  vi.stubEnv('SECOND_ADMIN_EMAIL', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('two configured admin identities', () => {
  it('allows only the primary identity until the second slot is configured', () => {
    expect(isAdminEmail(' OWNER@EXAMPLE.TEST ')).toBe(true);
    for (const email of ['second@example.test', 'owner+extra@example.test', 'other@illinois.edu', '', 'invalid']) expect(isAdminEmail(email)).toBe(false);
    vi.stubEnv('SECOND_ADMIN_EMAIL', ' SECOND@EXAMPLE.TEST ');
    expect(isAdminEmail('second@example.test')).toBe(true);
    expect(isAdminEmail('owner@example.test')).toBe(true);
    expect(isAdminEmail('third@example.test')).toBe(false);
  });
  it('never treats a list, wildcard, or malformed setting as an admin identity', () => {
    vi.stubEnv('ADMIN_EMAIL', '');
    for (const value of ['first@example.test,second@example.test', '*@illinois.edu', 'not an email']) {
      vi.stubEnv('SECOND_ADMIN_EMAIL', value);
      for (const email of [value, 'first@example.test', 'second@example.test', 'student@illinois.edu']) expect(isAdminEmail(email)).toBe(false);
    }
  });
});
