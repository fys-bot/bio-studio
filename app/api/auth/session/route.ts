import { NextResponse } from "next/server";
import { currentSessionToken, readSession } from "@/lib/auth";

export async function GET() {
  const accessToken = currentSessionToken();
  const session = readSession(accessToken);
  if (!accessToken || !session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    authenticated: true,
    accessToken,
    expiresAt: session.exp,
    user: { name: session.name, role: session.role },
  });
}
