import { privateJson } from '@/lib/api';
import { getSubscriptionResult } from '@/lib/subscriptions';

/** RFC 8058 requests are authenticated by the opaque token, not a browser cookie. */
export async function POST(request: Request) {
  const result = await getSubscriptionResult(new URL(request.url).searchParams.get('token') ?? undefined, 'unsubscribe');
  if (result === 'unavailable') return privateJson({ error: 'Please try unsubscribing again in a moment.' }, 503);
  if (result === 'invalid') return privateJson({ error: 'That unsubscribe link is incomplete.' }, 400);
  return privateJson({ ok: true });
}
