"use client";

import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import ExtensionRounded from "@mui/icons-material/ExtensionRounded";

export function ResourceLoading({
  variant,
  label,
  detail,
}: {
  variant: "skills" | "files";
  label: string;
  detail?: string;
}) {
  const Icon = variant === "skills" ? ExtensionRounded : DescriptionOutlined;
  return (
    <section className={`resource-loading ${variant}`} role="status" aria-live="polite">
      <span className="resource-loading-visual" aria-hidden="true">
        <Icon sx={{ fontSize: 20 }} />
        <i />
        <i />
        <i />
      </span>
      <span>
        <b>{label}</b>
        <small>
          {detail || (variant === "skills" ? "同步技能契约与启用状态" : "同步解析状态与索引摘要")}
        </small>
      </span>
    </section>
  );
}
