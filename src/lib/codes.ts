import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
export function generateCode() { return randomInt(0, 1_000_000).toString().padStart(6, '0'); }
export function hashCode(id: string, code: string, pepper: string) { if (pepper.length < 32) throw new Error('CODE_PEPPER must contain at least 32 characters'); return createHmac('sha256', pepper).update(`${id}:${code}`).digest('hex'); }
export function matchesCode(hash: string, candidate: string) { return /^[a-f0-9]{64}$/.test(hash) && /^[a-f0-9]{64}$/.test(candidate) && timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex')); }
export function codeState(expiresAt: string, attempts: number, now = Date.now()) { if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= now) return 'expired'; return attempts >= MAX_CODE_ATTEMPTS ? 'locked' : 'valid'; }
