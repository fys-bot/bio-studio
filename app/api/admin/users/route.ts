import { NextResponse } from "next/server";
import { allPermissions, type BioflowPermission, type BioflowRole } from "@/lib/access-control";
import { authorizationError, currentAuthContext, isSameOrigin } from "@/lib/auth";
import { createManagedUser, listUsers, updateManagedUser } from "@/lib/user-store";

function guard(request?: Request) {
  const error = authorizationError("users:manage");
  if (error) return NextResponse.json({ error: error.error }, { status: error.status });
  if (request && !isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }
  return null;
}

function validRole(value: unknown): value is BioflowRole {
  return value === "researcher" || value === "reviewer" || value === "admin";
}

function validPermissions(value: unknown): value is BioflowPermission[] {
  return (
    Array.isArray(value) &&
    value.every((permission) => allPermissions.includes(permission as BioflowPermission))
  );
}

export async function GET() {
  const denied = guard();
  if (denied) return denied;
  return NextResponse.json({ users: listUsers() });
}

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  const input = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (
    !input ||
    typeof input.username !== "string" ||
    typeof input.password !== "string" ||
    typeof input.name !== "string" ||
    !validRole(input.role) ||
    (input.permissions !== undefined && !validPermissions(input.permissions))
  ) {
    return NextResponse.json({ error: "用户字段不完整或权限值无效" }, { status: 400 });
  }
  try {
    const user = createManagedUser({
      username: input.username,
      password: input.password,
      name: input.name,
      role: input.role,
      permissions: input.permissions,
      enabled: typeof input.enabled === "boolean" ? input.enabled : true,
    });
    return NextResponse.json({ user, users: listUsers() }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建用户失败" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  const input = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!input || typeof input.id !== "string") {
    return NextResponse.json({ error: "缺少用户标识" }, { status: 400 });
  }
  const context = currentAuthContext();
  if (
    context?.user.id === input.id &&
    (input.enabled === false || (input.role !== undefined && input.role !== "admin"))
  ) {
    return NextResponse.json(
      { error: "不能停用当前管理员或移除自己的管理员角色" },
      { status: 409 },
    );
  }
  if (input.role !== undefined && !validRole(input.role)) {
    return NextResponse.json({ error: "角色值无效" }, { status: 400 });
  }
  if (input.permissions !== undefined && !validPermissions(input.permissions)) {
    return NextResponse.json({ error: "权限列表包含无效值" }, { status: 400 });
  }
  try {
    const user = updateManagedUser(input.id, {
      name: typeof input.name === "string" ? input.name : undefined,
      role: validRole(input.role) ? input.role : undefined,
      permissions: validPermissions(input.permissions) ? input.permissions : undefined,
      enabled: typeof input.enabled === "boolean" ? input.enabled : undefined,
      password: typeof input.password === "string" && input.password ? input.password : undefined,
    });
    return NextResponse.json({ user, users: listUsers() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新用户失败" },
      { status: 400 },
    );
  }
}
