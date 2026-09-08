import { NextResponse } from "next/server";
import { authGuard, isSameOrigin } from "@/lib/auth";
import { resetDemoState } from "@/lib/store";

export async function POST(request: Request) {
  const denied = authGuard("tasks:write");
  if (denied) return denied;
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  if (process.env.NODE_ENV === "production")
    return NextResponse.json({ error: "Disabled in production" }, { status: 404 });
  return NextResponse.json({ task: resetDemoState() });
}
