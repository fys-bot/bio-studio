import { NextResponse } from "next/server";
import { authGuard, isAuthorized, isSameOrigin } from "@/lib/auth";
import { createSkill, listSkills } from "@/lib/catalog-service";

export async function GET(request: Request) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  return NextResponse.json(
    listSkills({
      search: url.searchParams.get("search") ?? undefined,
      source: url.searchParams.get("source") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      availability: url.searchParams.get("availability") ?? undefined,
      page: Number(url.searchParams.get("page") || 1),
      pageSize: Number(url.searchParams.get("pageSize") || 6),
    }),
  );
}

export async function POST(request: Request) {
  const denied = authGuard("skills:write");
  if (denied) return denied;
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  try {
    return NextResponse.json({ skill: createSkill(await request.json()) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "技能格式无效" },
      { status: 400 },
    );
  }
}
