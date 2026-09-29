import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

// Com RUN_TEST_TOKEN definido, exige "Authorization: Bearer <token>". Sem ele (dev local), libera.
export function authorized(request) {
  const token = process.env.RUN_TEST_TOKEN;
  if (!token) return true;
  const got = Buffer.from(request.headers.get('authorization') || '');
  const want = Buffer.from(`Bearer ${token}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export const unauthorized = () =>
  NextResponse.json({ success: false, error: 'Não autorizado: envie o header Authorization: Bearer <RUN_TEST_TOKEN>.' }, { status: 401 });
