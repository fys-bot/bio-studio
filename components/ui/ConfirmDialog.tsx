"use client";

import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import { Button, CircularProgress } from "@mui/material";
import { ResponsiveDialog } from "./ResponsiveDialog";

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
  return (
    <ResponsiveDialog
      open={open}
      title={title}
      eyebrow="不可逆操作"
      busy={busy}
      maxWidth="xs"
      onClose={onClose}
      className="confirm-dialog"
      actions={
        <>
          <Button color="inherit" disabled={busy} onClick={onClose}>
            取消
          </Button>
          <Button color="error" variant="contained" disabled={busy} onClick={onConfirm}>
            {busy && <CircularProgress size={14} color="inherit" sx={{ mr: 0.8 }} />}
            {busy ? "处理中…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="confirm-dialog-body">
        <span className="confirm-dialog-icon" aria-hidden="true">
          <WarningAmberRounded fontSize="small" />
        </span>
        <p id="confirm-dialog-description">{description}</p>
        {error && (
          <p className="confirm-dialog-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </ResponsiveDialog>
  );
}
