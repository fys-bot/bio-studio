"use client";

import { useEffect, useState } from "react";

type ApiErrorNotice = { id: number; message: string };

/** Places terminal API failures above every page without replacing local recovery controls. */
export function GlobalApiFeedback() {
  const [notice, setNotice] = useState<ApiErrorNotice | null>(null);

  useEffect(() => {
    const onError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: unknown }>).detail;
      const message = typeof detail?.message === "string" ? detail.message.trim() : "";
      if (!message) return;
      setNotice({ id: Date.now(), message });
    };
    window.addEventListener("bioflow:api-error", onError);
    return () => window.removeEventListener("bioflow:api-error", onError);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5_500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;
  return (
    <aside className="global-api-feedback" role="alert" aria-live="assertive">
      <span aria-hidden="true">!</span>
      <b>请求未完成</b>
      <p>{notice.message}</p>
      <button type="button" onClick={() => setNotice(null)} aria-label="关闭错误提示">
        关闭
      </button>
    </aside>
  );
}
