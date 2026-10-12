import 'server-only';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateCode, hashCode } from '@/lib/codes';
import { site } from '@/lib/config';
import { sendMail } from '@/lib/email';
import { escapeHtml } from '@/lib/format';
import { assertOrigin, limitedJson, rateLimit, requestIp, secret } from '@/lib/security';
import { serviceDatabase } from '@/lib/supabase/service';
import { submissionSchema } from '@/lib/validation';

export const SUBMISSION_COOKIE = 'ia_submission';
const noStore = { 'Cache-Control': 'private, no-store' };
const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the six digit code from your email.') });
const idSchema = z.uuid();

class SubmissionError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

type Challenge = {
  id: string; email: string; author_name: string; original_body: string;
  verified_at: string | null; post_id: string | null; confirmation_sent_at: string | null;
};

function configured() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.RESEND_API_KEY || !process.env.MAIL_FROM || (process.env.CODE_PEPPER?.length ?? 0) < 32) {
    throw new SubmissionError('Submissions are not connected yet. Please try again soon.', 503);
  }
}

function checkOrigin(request: Request) {
  try { assertOrigin(request); }
  catch { throw new SubmissionError('Refresh the page and try again.', 403); }
}

async function readJson(request: Request, maxBytes = 90_000) {
  try { return await limitedJson(request, maxBytes); }
  catch (error) {
    const large = error instanceof Error && error.message.includes('too large');
    throw new SubmissionError(large ? 'That request is too large.' : 'Please complete the form and try again.', large ? 413 : 400);
  }
}

async function limit(scope: string, identity: string, count: number, seconds: number) {
  try { await rateLimit(scope, identity, count, seconds); }
  catch (error) {
    if (error instanceof Error && error.message.includes('too many')) {
      throw new SubmissionError('A few too many tries. Please wait a little and try again.', 429);
    }
    throw new SubmissionError('Please try again in a moment.', 503);
  }
}

async function codeLimits(request: Request, email: string) {
  await limit('submission-code-ip', requestIp(request), 30, 3600);
  await limit('submission-code-email', email, 5, 3600);
  await limit('submission-code-cooldown', email, 1, 60);
}

function success(id?: string) {
  const response = NextResponse.json({ ok: true }, { headers: noStore });
  if (id) response.cookies.set(SUBMISSION_COOKIE, id, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' || site.url.startsWith('https://'),
    path: '/', maxAge: 3600,
  });
  return response;
}

function failure(error: unknown) {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return NextResponse.json({ error: issue?.path[0] === 'website' ? 'Please check the form and try again.' : issue?.message || 'Please check the form and try again.' }, { status: 400, headers: noStore });
  }
  if (error instanceof SubmissionError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: { ...noStore, ...(error.status === 429 ? { 'Retry-After': '60' } : {}) } });
  }
  console.error('Submission service unavailable.');
  return NextResponse.json({ error: 'We could not complete that step. Please try again in a moment.' }, { status: 503, headers: noStore });
}

function challengeId(request: NextRequest) {
  const parsed = idSchema.safeParse(request.cookies.get(SUBMISSION_COOKIE)?.value);
  if (!parsed.success) throw new SubmissionError('Start with your piece, then request a code.', 400);
  return parsed.data;
}

async function challenge(id: string): Promise<Challenge> {
  const { data, error } = await serviceDatabase().from('email_verifications')
    .select('id,email,author_name,original_body,verified_at,post_id,confirmation_sent_at').eq('id', id).maybeSingle();
  if (error) throw new SubmissionError('Please try again in a moment.', 503);
  if (!data) throw new SubmissionError('Start with your piece, then request a code.', 400);
  return data as Challenge;
}

async function issueCode(id: string, email: string, name: string, body: string) {
  const code = generateCode();
  const hash = hashCode(id, code, secret('CODE_PEPPER'));
  const { error } = await serviceDatabase().rpc('start_verification', {
    p_id: id, p_email: email, p_author_name: name, p_original_body: body, p_code_hash: hash,
  });
  if (error) throw new SubmissionError('We could not prepare your code. Please try again.', 503);
  await sendMail({
    to: email, subject: 'Your Illinois Abundance code',
    html: `<h1 style="font-size:30px;line-height:1.15">One last step.</h1><p>Enter this code to send your piece to our reviewers:</p><p style="font-size:36px;letter-spacing:8px;font-weight:bold">${code}</p><p>It expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
    text: `Your Illinois Abundance code is ${code}. It expires in 10 minutes. Enter it on the site to send your piece to our reviewers. If you did not request it, you can ignore this email.`,
    idempotencyKey: `submission-code/${id}/${hash}`,
  });
}

async function confirmSavedSubmission(value: Challenge) {
  if (value.confirmation_sent_at || !value.post_id) return;
  try {
    await limit('submission-confirmation', value.email, 5, 3600);
    await sendMail({
      to: value.email, subject: 'We got your piece',
      html: `<h1 style="font-size:30px;line-height:1.15">Got it, ${escapeHtml(value.author_name)}.</h1><p>One of our reviewers will contact you soon. Your original submission is saved, and we will work on any edits with you by email.</p><p>Your piece will only appear on the site after a reviewer publishes it. You can ask us to take it down any time.</p>`,
      text: `Got it, ${value.author_name}. One of our reviewers will contact you soon. Your original submission is saved, and we will work on any edits with you by email. Your piece will only appear on the site after a reviewer publishes it. You can ask us to take it down any time.`,
      idempotencyKey: `submission-confirmation/${value.post_id}`,
    });
    const { error } = await serviceDatabase().from('email_verifications')
      .update({ confirmation_sent_at: new Date().toISOString() }).eq('id', value.id).is('confirmation_sent_at', null);
    if (error) console.error('Submission confirmation delivery marker could not be saved.');
  } catch {
    // The submission transaction has committed. A mail outage must never ask the
    // student to resubmit it. Retrying verification repairs delivery idempotently.
    console.error('Submission saved; confirmation email is pending retry.');
  }
}

export async function requestSubmission(request: NextRequest) {
  try {
    checkOrigin(request);
    const input = submissionSchema.parse(await readJson(request));
    configured();
    await codeLimits(request, input.email);
    const id = randomUUID();
    await issueCode(id, input.email, input.name, input.body);
    return success(id);
  } catch (error) { return failure(error); }
}

export async function resendSubmission(request: NextRequest) {
  try {
    checkOrigin(request);
    if (request.body) z.object({}).strict().parse(await readJson(request, 1024));
    configured();
    const id = challengeId(request);
    const value = await challenge(id);
    if (value.verified_at) throw new SubmissionError('Your piece is already saved. You do not need another code.', 400);
    await codeLimits(request, value.email);
    await issueCode(id, value.email, value.author_name, value.original_body);
    return success(id);
  } catch (error) { return failure(error); }
}

export async function verifySubmission(request: NextRequest) {
  try {
    checkOrigin(request);
    const { code } = codeSchema.parse(await readJson(request, 1024));
    configured();
    const id = challengeId(request);
    await limit('submission-verify-ip', requestIp(request), 60, 600);
    const { data, error } = await serviceDatabase().rpc('verify_submission', {
      p_id: id, p_code_hash: hashCode(id, code, secret('CODE_PEPPER')),
    });
    if (error) throw new SubmissionError('We could not check that code. Please try again.', 503);
    if (data?.status === 'mismatch') throw new SubmissionError("That code didn't match. Try again.", 400);
    if (data?.status === 'expired') throw new SubmissionError('That code has expired. Send a new code and try again.', 400);
    if (data?.status === 'locked') throw new SubmissionError('Those tries are used up. Send a new code and try again.', 429);
    if (data?.status === 'missing') throw new SubmissionError('Start with your piece, then request a code.', 400);
    if (data?.status !== 'verified' && data?.status !== 'already_verified') throw new SubmissionError('We could not check that code. Please try again.', 503);
    try { await confirmSavedSubmission(await challenge(id)); }
    catch { console.error('Submission saved; confirmation details are temporarily unavailable.'); }
    return success();
  } catch (error) { return failure(error); }
}
