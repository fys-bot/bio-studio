"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认删除",
  busy = false,
  error = "",
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;
  return (
    <div className="ui-modal-backdrop confirm-backdrop" onMouseDown={() => !busy && onClose()}>
      <section
        className="ui-modal confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <span className="confirm-dialog-icon" aria-hidden="true">
            <AlertTriangle size={18} />
          </span>
          <div>
            <small>不可逆操作</small>
            <h2 id="confirm-dialog-title">{title}</h2>
          </div>
          <button disabled={busy} onClick={onClose} aria-label="关闭确认弹窗">
            <X size={16} />
          </button>
        </header>
        <p id="confirm-dialog-description">{description}</p>
        {error && (
          <p className="confirm-dialog-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button ref={cancelRef} className="secondary" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button className="danger-button" disabled={busy} onClick={onConfirm}>
            {busy ? "处理中…" : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
