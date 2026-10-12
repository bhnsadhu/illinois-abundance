import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertOrigin, limitedJson, rateLimit } from '@/lib/security';

export class HttpError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export function privateJson(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export function requireOrigin(request: Request) {
  try { assertOrigin(request); } catch { throw new HttpError('Refresh the page and try again.', 403); }
}
export async function readJson(request: Request, maxBytes = 160_000) {
  try { return await limitedJson(request, maxBytes); }
  catch (error) { throw new HttpError(error instanceof Error && error.message.includes('too large') ? 'That request is too large.' : 'Please complete the form and try again.', error instanceof Error && error.message.includes('too large') ? 413 : 400); }
}
export async function guardRateLimit(scope: string, identity: string, count: number, seconds: number) {
  try { await rateLimit(scope, identity, count, seconds); }
  catch (error) { throw new HttpError(error instanceof Error && error.message.includes('too many') ? 'A few too many tries. Please wait a little and try again.' : 'Please try again in a moment.', error instanceof Error && error.message.includes('too many') ? 429 : 503); }
}
export function apiFailure(error: unknown) {
  if (error instanceof HttpError) return privateJson({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return privateJson({ error: error.issues[0]?.message || 'Please check the form and try again.' }, 400);
  console.error('Private request could not be completed.');
  return privateJson({ error: 'We could not complete that step. Please try again.' }, 503);
}
