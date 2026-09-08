"use client";

import AssessmentOutlined from "@mui/icons-material/AssessmentOutlined";
import ChecklistRounded from "@mui/icons-material/ChecklistRounded";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import EditNoteRounded from "@mui/icons-material/EditNoteRounded";
import MemoryRounded from "@mui/icons-material/MemoryRounded";
import { IconButton, Tooltip } from "@mui/material";
import type { InspectorTab } from "./InspectorDrawer";

type WorkspaceToolDockProps = {
  activeTab: InspectorTab;
  inspectorOpen: boolean;
  realExecution: boolean;
  onOpenInspector: (tab: InspectorTab) => void;
  onOpenDocumentation: () => void;
  onOpenRealAnalysis: () => void;
};

const tools = [
  { key: "todo", label: "待办", Icon: ChecklistRounded },
  { key: "results", label: "结果", Icon: AssessmentOutlined },
  { key: "compute", label: "计算", Icon: MemoryRounded },
  { key: "notes", label: "笔记", Icon: EditNoteRounded },
  { key: "docs", label: "文档", Icon: DescriptionOutlined },
] as const;

/** 工作台上下文命令栏：桌面只保留图标，移动端显示图标和短标签。 */
export function WorkspaceToolDock({
  activeTab,
  inspectorOpen,
  realExecution,
  onOpenInspector,
  onOpenDocumentation,
  onOpenRealAnalysis,
}: WorkspaceToolDockProps) {
  return (
    <nav className="tool-dock workspace-tool-dock" aria-label="研究工具">
      {tools.map(({ key, label, Icon }) => {
        const selected = inspectorOpen && activeTab === key;
        return (
          <Tooltip key={key} title={label} placement="left">
            <IconButton
              aria-label={`打开${label}`}
              aria-pressed={selected}
              className={selected ? "active" : ""}
              onClick={() => {
                if (key === "docs") {
                  onOpenDocumentation();
                  return;
                }
                if (realExecution && (key === "results" || key === "compute")) {
                  onOpenRealAnalysis();
                  return;
                }
                onOpenInspector(key);
              }}
            >
              <Icon className="tool-dock-icon" sx={{ fontSize: 18 }} />
              <span className="tool-dock-label">{label}</span>
            </IconButton>
          </Tooltip>
        );
      })}
    </nav>
  );
}
