"use client";

import CloseRounded from "@mui/icons-material/CloseRounded";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  type DialogProps,
} from "@mui/material";
import type { ReactNode } from "react";

type ResponsiveDialogProps = {
  open: boolean;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  actions?: ReactNode;
  busy?: boolean;
  maxWidth?: DialogProps["maxWidth"];
  className?: string;
  onClose: () => void;
};

/** 全站统一弹窗：桌面保持紧凑，中小屏自动转为底部全宽面板。 */
export function ResponsiveDialog({
  open,
  title,
  eyebrow,
  children,
  actions,
  busy = false,
  maxWidth = "sm",
  className = "",
  onClose,
}: ResponsiveDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth={maxWidth}
      aria-label={title}
      className={`responsive-dialog ${className}`}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: "rgba(28, 39, 33, 0.38)",
            backdropFilter: "blur(10px) saturate(0.9)",
            WebkitBackdropFilter: "blur(10px) saturate(0.9)",
          },
        },
        paper: {
          sx: {
            m: { xs: 0.75, sm: 2 },
            width: { xs: "calc(100% - 12px)", sm: "calc(100% - 32px)" },
            maxHeight: { xs: "calc(100dvh - 12px)", sm: "calc(100dvh - 32px)" },
            borderRadius: { xs: "10px 10px 0 0", sm: "8px" },
            alignSelf: { xs: "flex-end", sm: "center" },
            overflow: "hidden",
          },
        },
      }}
    >
      <DialogTitle className="responsive-dialog-title">
        <span>
          {eyebrow && <small>{eyebrow}</small>}
          <b>{title}</b>
        </span>
        <IconButton size="small" disabled={busy} onClick={onClose} aria-label={`关闭${title}`}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent className="responsive-dialog-content" dividers>
        {children}
      </DialogContent>
      {actions && <DialogActions className="responsive-dialog-actions">{actions}</DialogActions>}
    </Dialog>
  );
}
