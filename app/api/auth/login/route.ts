import { NextResponse } from "next/server";
import { issueSession, isSameOrigin } from "@/lib/auth";
import { roleLabel, type BioflowRole } from "@/lib/access-control";
import { verifyUserPassword } from "@/lib/user-store";

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
    role?: BioflowRole;
  };
  if (!body.role || !["researcher", "reviewer", "admin"].includes(body.role)) {
    return NextResponse.json(
      { error: "请选择有效的登录角色", code: "INVALID_ROLE" },
      { status: 400 },
    );
  }
  const verification = verifyUserPassword(body.username || "", body.password || "");
  if (verification.status === "not_found") {
    return NextResponse.json(
      { error: "系统中未找到该账号。如需注册，请联系管理员创建账号。", code: "ACCOUNT_NOT_FOUND" },
      { status: 404 },
    );
  }
  if (verification.status === "wrong_password") {
    return NextResponse.json(
      { error: "密码不正确，请重新输入。", code: "WRONG_PASSWORD" },
      { status: 401 },
    );
  }
  if (!verification.user.enabled) {
    return NextResponse.json(
      { error: "该账号已停用，请联系管理员恢复。", code: "ACCOUNT_DISABLED" },
      { status: 403 },
    );
  }
  if (verification.user.role !== body.role) {
    return NextResponse.json(
      {
        error: `账号已分配为${roleLabel(verification.user.role)}，不能以${roleLabel(body.role)}身份登录。`,
        code: "ROLE_MISMATCH",
      },
      { status: 403 },
    );
  }

  const accessToken = issueSession(verification.user);
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  return NextResponse.json({
    authenticated: true,
    accessToken,
    expiresAt,
    user: {
      id: verification.user.id,
      username: verification.user.username,
      name: verification.user.name,
      role: verification.user.role,
      permissions: verification.user.permissions,
    },
  });
}
