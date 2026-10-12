import type { NextRequest } from 'next/server';
import { verifySubmission } from '@/lib/submissions';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) { return verifySubmission(request); }
