import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'bioflow_session';
const DEMO_SESSION = 'demo-session-v1';

export function isAuthorized() {
  return cookies().get(SESSION_COOKIE)?.value === DEMO_SESSION;
}

export function demoSession() { return DEMO_SESSION; }
