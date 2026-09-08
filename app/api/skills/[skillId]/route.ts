import { NextResponse } from "next/server";
import { authGuard, isAuthorized, isSameOrigin } from "@/lib/auth";
import { getSkill, setSkillEnabled } from "@/lib/catalog-service";

export async function GET(_: Request, { params }: { params: { skillId: string } }) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const skill = getSkill(params.skillId);
  return skill
    ? NextResponse.json({ skill })
    : NextResponse.json({ error: "技能不存在" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: { skillId: string } }) {
  const denied = authGuard("skills:write");
  if (denied) return denied;
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const payload = (await request.json().catch(() => ({}))) as { enabled?: unknown };
  if (typeof payload.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled 必须为布尔值" }, { status: 400 });
  }
  const skill = setSkillEnabled(params.skillId, payload.enabled);
  return skill
    ? NextResponse.json({ skill })
    : NextResponse.json({ error: "技能不存在" }, { status: 404 });
}
