import { NextRequest } from 'next/server';
import { eventsAfter } from '@/lib/store';
import { isAuthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export async function GET(req:NextRequest,{params}:{params:{runId:string}}) {
  if(!isAuthorized()) return new Response('Unauthorized',{status:401});
  const initial=Number(req.nextUrl.searchParams.get('after')||0); let cursor=initial; let timer:ReturnType<typeof setInterval>;
  const stream=new ReadableStream({start(controller){ const send=()=>{ const items=eventsAfter(cursor); items.forEach(e=>{cursor=e.id; controller.enqueue(`id: ${e.id}\ndata: ${JSON.stringify(e)}\n\n`);}); }; send(); timer=setInterval(send,250); req.signal.addEventListener('abort',()=>{clearInterval(timer); controller.close();}); },cancel(){clearInterval(timer);}});
  return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'}});
}
