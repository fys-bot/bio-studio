import { NextResponse } from 'next/server';
import { demoSession, SESSION_COOKIE } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ ok: true, user: { name: 'Derrick', role: 'researcher' } });
  response.cookies.set(SESSION_COOKIE, demoSession(), { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 8 });
  return response;
}
