import type { NextRequest } from 'next/server';
import { resendSubmission } from '@/lib/submissions';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) { return resendSubmission(request); }
