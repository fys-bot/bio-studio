"use client";

type ContentLoadingProps = {
  label?: string;
};

/** 仅覆盖工作区内容的轻量加载态，避免任务切换时打断侧栏和全局导航。 */
export function ContentLoading({ label = "正在切换任务" }: ContentLoadingProps) {
  return (
    <div className="content-loading" role="status" aria-live="polite">
      <div className="content-loading-stream" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div>
        <b>{label}</b>
        <small>正在恢复研究上下文、文件和工作流布局</small>
      </div>
    </div>
  );
}
