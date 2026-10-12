import { requestSubscription } from '@/lib/subscriptions';

export async function POST(request: Request) { return requestSubscription(request); }
