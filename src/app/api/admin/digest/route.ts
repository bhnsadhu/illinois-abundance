import { sendDigest } from '@/lib/digest';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) { return sendDigest(request); }
