import { NextResponse } from 'next/server';
import { isAuthorized, isSameOrigin } from '@/lib/auth';
import { resetDemoState } from '@/lib/store';

export async function POST(request: Request) {
  if (!isAuthorized()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Disabled in production' }, { status: 404 });
  return NextResponse.json({ task: resetDemoState() });
}
