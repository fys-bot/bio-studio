import { NextResponse } from "next/server";
import { currentAuthContext, currentSessionToken } from "@/lib/auth";

export async function GET() {
  const accessToken = currentSessionToken();
  const context = currentAuthContext();
  if (!accessToken || !context)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    authenticated: true,
    accessToken,
    expiresAt: context.session.exp,
    user: {
      id: context.user.id,
      username: context.user.username,
      name: context.user.name,
      role: context.user.role,
      permissions: context.user.permissions,
    },
  });
}
