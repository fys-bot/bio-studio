"use client";

import RefreshRounded from "@mui/icons-material/RefreshRounded";
import { Button, CircularProgress } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  ApiClientError,
  bioflowApi,
  clearAccessToken,
  getAccessToken,
  type LoginResponse,
} from "@/lib/api-client";
import type { BioflowSessionUser } from "@/lib/access-control";

let sessionVerified = false;
let verifiedUser: BioflowSessionUser | null = null;
let verifiedToken = "";

function resetCachedSession() {
  sessionVerified = false;
  verifiedUser = null;
  verifiedToken = "";
}

/** 登录身份切换时清掉根布局中的旧用户快照，避免研究员权限泄漏到管理员界面。 */
export function invalidateAuthSessionCache() {
  resetCachedSession();
}

const AuthSessionContext = createContext<{ user: BioflowSessionUser | null }>({ user: null });

export function useAuthSession() {
  return useContext(AuthSessionContext);
}

export function AuthSessionGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "error">("checking");
  const [user, setUser] = useState<BioflowSessionUser | null>(verifiedUser);

  const verifySession = useCallback(async () => {
    if (pathname === "/login") {
      resetCachedSession();
      setUser(null);
      setStatus("ready");
      return;
    }
    const accessToken = getAccessToken();
    if (!accessToken) {
      resetCachedSession();
      setUser(null);
      setStatus("checking");
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
      return;
    }
    if (sessionVerified && verifiedToken === accessToken && verifiedUser) {
      setUser(verifiedUser);
      setStatus("ready");
      return;
    }
    setStatus("checking");
    try {
      const response: LoginResponse = await bioflowApi.restoreSession();
      // 登录状态可能在请求期间被切换；旧请求不能覆盖新身份。
      if (getAccessToken() !== accessToken) return;
      sessionVerified = true;
      verifiedUser = response.user;
      verifiedToken = accessToken;
      setUser(response.user);
      setStatus("ready");
    } catch (error) {
      resetCachedSession();
      setUser(null);
      clearAccessToken();
      if (error instanceof ApiClientError && error.status === 401) {
        const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
        router.replace(`/login${next}`);
        return;
      }
      setStatus("error");
    }
  }, [pathname, router]);

  useEffect(() => {
    void verifySession();
  }, [verifySession]);

  if (pathname === "/login" || status === "ready") {
    return <AuthSessionContext.Provider value={{ user }}>{children}</AuthSessionContext.Provider>;
  }

  return (
    <main className="session-gate" role="status" aria-live="polite">
      <div className="session-gate-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div>
        <b>{status === "error" ? "无法验证工作区会话" : "正在验证科研工作区"}</b>
        <small>
          {status === "error" ? "请确认本地服务正常运行后重试" : "校验访问令牌与研究权限"}
        </small>
      </div>
      {status === "error" ? (
        <Button size="small" startIcon={<RefreshRounded />} onClick={() => void verifySession()}>
          重新连接
        </Button>
      ) : (
        <CircularProgress size={18} />
      )}
    </main>
  );
}
