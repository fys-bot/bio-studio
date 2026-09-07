import { NextResponse } from "next/server";
import { demoSession, isSameOrigin, safeCredentialEqual, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  const expectedUser = process.env.BIOFLOW_DEMO_USER || "researcher";
  const expectedPassword = process.env.BIOFLOW_DEMO_PASSWORD || "bioflow2026";
  if (
    !safeCredentialEqual(body.username || "", expectedUser) ||
    !safeCredentialEqual(body.password || "", expectedPassword)
  ) {
    return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
  }

  const accessToken = demoSession();
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const response = NextResponse.json({
    authenticated: true,
    accessToken,
    expiresAt,
    user: { name: "DF 研究员", role: "researcher" },
  });
  response.cookies.set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
