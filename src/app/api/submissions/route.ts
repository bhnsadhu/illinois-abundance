import type { NextRequest } from 'next/server';
import { requestSubmission } from '@/lib/submissions';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) { return requestSubmission(request); }
