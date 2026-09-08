import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { headers } from "next/headers";

const authRuntimeRegistry = globalThis as typeof globalThis & {
  __bioflowSessionNonce?: string;
};

// 演示工作台要求服务重启后重新登录；globalThis 可避免开发热更新误伤当前会话。
authRuntimeRegistry.__bioflowSessionNonce ??= randomBytes(24).toString("base64url");

const secret = () =>
  `${process.env.BIOFLOW_SESSION_SECRET || "local-demo-secret-change-in-production"}:${authRuntimeRegistry.__bioflowSessionNonce}`;

export type SessionPayload = {
  sub: string;
  name: string;
  role: "researcher" | "reviewer" | "admin";
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

export function isAuthorized() {
  return Boolean(readSession(currentSessionToken()));
}

export function demoSession(name = "DF 研究员", role: SessionPayload["role"] = "researcher") {
  return signedToken({
    sub: `demo-${role}`,
    name,
    role,
    exp: Date.now() + 8 * 60 * 60 * 1000,
  });
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
