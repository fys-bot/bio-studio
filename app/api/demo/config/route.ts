import { NextResponse } from "next/server";
import { configSnapshot, updateDemoConfig } from "@/lib/store";
import { authGuard, isAuthorized, isSameOrigin } from "@/lib/auth";

export async function GET() {
  if (!isAuthorized()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ config: configSnapshot() });
}

export async function POST(request: Request) {
  const denied = authGuard("tasks:write");
  if (denied) return denied;
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }
  const input = await request.json().catch(() => ({}));
  return NextResponse.json({ config: updateDemoConfig(input) });
}
