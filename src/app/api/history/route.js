import { NextResponse } from 'next/server';
import { authorized, unauthorized } from '@/lib/auth';
import { listRuns } from '@/lib/history';

export async function GET(request) {
  if (!authorized(request)) return unauthorized();
  return NextResponse.json({ runs: await listRuns() });
}
