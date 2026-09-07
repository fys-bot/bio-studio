"use client";

import RefreshRounded from "@mui/icons-material/RefreshRounded";
import { Button, CircularProgress } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ApiClientError, bioflowApi, clearAccessToken } from "@/lib/api-client";

export function AuthSessionGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "error">("checking");

  const verifySession = useCallback(async () => {
    if (pathname === "/login") {
      setStatus("ready");
      return;
    }
    setStatus("checking");
    try {
      await bioflowApi.restoreSession();
      setStatus("ready");
    } catch (error) {
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

  if (pathname === "/login" || status === "ready") return children;

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
