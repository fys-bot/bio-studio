import { NextResponse } from "next/server";
import { authGuard, isSameOrigin } from "@/lib/auth";
import { approvePlan } from "@/lib/store";
export async function POST(request: Request) {
  const denied = authGuard("tasks:write");
  if (denied) return denied;
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  return NextResponse.json({ task: approvePlan() });
}
