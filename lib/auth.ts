import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = 'bioflow_session';
const secret = () => process.env.BIOFLOW_SESSION_SECRET || 'local-demo-secret-change-in-production';

export function isAuthorized() {
  const token=cookies().get(SESSION_COOKIE)?.value; if(!token)return false;
  const [payload,signature]=token.split('.'); if(!payload||!signature)return false;
  const expected=createHmac('sha256',secret()).update(payload).digest('base64url');
  if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return false;
  try { const session=JSON.parse(Buffer.from(payload,'base64url').toString()) as {exp:number;role:string}; return session.role==='researcher'&&session.exp>Date.now(); } catch { return false; }
}

export function demoSession() { const payload=Buffer.from(JSON.stringify({sub:'demo-researcher',role:'researcher',exp:Date.now()+8*60*60*1000})).toString('base64url'); const signature=createHmac('sha256',secret()).update(payload).digest('base64url'); return `${payload}.${signature}`; }

export function isSameOrigin(request:Request) {
  const origin=request.headers.get('origin'); if(!origin)return true;
  try { return new URL(origin).host===request.headers.get('host'); } catch { return false; }
}
