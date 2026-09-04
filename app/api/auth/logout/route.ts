import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
export async function POST() { const r = NextResponse.json({ ok: true }); r.cookies.set(SESSION_COOKIE, '', { httpOnly: true, expires: new Date(0), path: '/' }); return r; }
