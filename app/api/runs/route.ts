import { NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/auth';

export async function POST() {
  if (!isAuthorized()) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  return NextResponse.json({ runId:'run_demo_001', status:'running' });
}
