import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { headers } from "next/headers";
import type { BioflowPermission, BioflowRole } from "@/lib/access-control";
import { findManagedUserById, type ManagedUser } from "@/lib/user-store";

const authRuntimeRegistry = globalThis as typeof globalThis & {
  __bioflowSessionNonce?: string;
};

// 演示工作台要求服务重启后重新登录；globalThis 可避免开发热更新误伤当前会话。
authRuntimeRegistry.__bioflowSessionNonce ??= randomBytes(24).toString("base64url");

const secret = () =>
  `${process.env.BIOFLOW_SESSION_SECRET || "local-demo-secret-change-in-production"}:${authRuntimeRegistry.__bioflowSessionNonce}`;

export type SessionPayload = {
  sub: string;
  username: string;
  name: string;
  role: BioflowRole;
  exp: number;
};

function signedToken(payload: SessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function readSession(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionPayload;
    return ["researcher", "reviewer", "admin"].includes(session.role) && session.exp > Date.now()
      ? session
      : null;
  } catch {
    return null;
  }
}

export function currentSessionToken() {
  const authorization = headers().get("authorization");
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

export function isAuthorized(permission?: BioflowPermission) {
  return !authorizationError(permission);
}

export function issueSession(user: ManagedUser) {
  return signedToken({
    sub: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    exp: Date.now() + 8 * 60 * 60 * 1000,
  });
}

export function currentAuthContext(): { session: SessionPayload; user: ManagedUser } | null {
  const session = readSession(currentSessionToken());
  if (!session) return null;
  const user = findManagedUserById(session.sub);
  if (!user || !user.enabled || user.role !== session.role) return null;
  return { session, user };
}

export function authorizationError(permission?: BioflowPermission) {
  const context = currentAuthContext();
  if (!context) return { status: 401 as const, error: "登录状态已失效，请重新登录" };
  if (permission && !context.user.permissions.includes(permission)) {
    return { status: 403 as const, error: "当前角色没有执行此操作的权限" };
  }
  return null;
}

export function authGuard(permission?: BioflowPermission) {
  const error = authorizationError(permission);
  return error ? Response.json({ error: error.error }, { status: error.status }) : null;
}

export function safeCredentialEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
