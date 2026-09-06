import { NextResponse } from 'next/server';
import { isAuthorized, isSameOrigin } from '@/lib/auth';
import { snapshot, resetDemoState } from '@/lib/store';

const nodes = [
  { id:'input', label:'Read count matrix', kind:'input', status:'succeeded', x:50, y:220, detail:'counts.csv · 24 samples' },
  { id:'qc', label:'Quality check', kind:'analysis', status:'succeeded', x:280, y:120, detail:'2 warnings resolved' },
  { id:'design', label:'Design matrix', kind:'gate', status:'failed', x:280, y:320, detail:'Missing condition column', error:'Map metadata.condition before retry' },
  { id:'de', label:'DESeq2 analysis', kind:'analysis', status:'blocked', x:540, y:220, detail:'Waiting for upstream' },
  { id:'volcano', label:'Volcano plot', kind:'artifact', status:'blocked', x:800, y:120, detail:'SVG + interactive chart' },
  { id:'report', label:'Research report', kind:'artifact', status:'blocked', x:800, y:320, detail:'Methods, results, evidence' },
];
const edges = [['input','qc'],['input','design'],['qc','de'],['design','de'],['de','volcano'],['de','report']];

export async function GET() {
  if (!isAuthorized()) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  return NextResponse.json({ task: snapshot() });
}

export async function POST(request: Request) {
  if (!isAuthorized()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Disabled in production' }, { status: 404 });
  return NextResponse.json({ task: resetDemoState() });
}
