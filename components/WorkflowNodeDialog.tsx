"use client";

import AccountTreeRounded from "@mui/icons-material/AccountTreeRounded";
import { Button } from "@mui/material";
import type { WorkflowNodeState } from "@/lib/domain";
import { ResponsiveDialog } from "./ui/ResponsiveDialog";

type WorkflowNodeDialogProps = {
  node: WorkflowNodeState | null;
  upstream: WorkflowNodeState[];
  downstream: WorkflowNodeState[];
  statusLabels: Record<string, string>;
  onClose: () => void;
  onOpenEvidence: () => void;
};

const kindLabels: Record<string, string> = {
  input: "输入",
  transform: "处理",
  analysis: "分析",
  evidence: "证据",
  artifact: "产物",
  gate: "决策",
};

/** 画布节点的短详情弹窗：拖拽仍编辑布局，轻点则查看节点上下文。 */
export function WorkflowNodeDialog({
  node,
  upstream,
  downstream,
  statusLabels,
  onClose,
  onOpenEvidence,
}: WorkflowNodeDialogProps) {
  if (!node) return null;

  return (
    <ResponsiveDialog
      open
      title={node.label}
      eyebrow="工作流节点"
      maxWidth="xs"
      className="workflow-node-dialog"
      onClose={onClose}
      actions={
        <>
          <Button color="inherit" onClick={onClose}>
            关闭
          </Button>
          <Button variant="contained" startIcon={<AccountTreeRounded />} onClick={onOpenEvidence}>
            查看节点证据
          </Button>
        </>
      }
    >
      <div className="workflow-node-dialog-body">
        <div className="workflow-node-dialog-status">
          <span className={`status-pill ${node.status}`}>
            {statusLabels[node.status] || node.status}
          </span>
          <span>{kindLabels[node.kind] || node.kind}</span>
        </div>
        <p>{node.detail}</p>
        <dl>
          <div>
            <dt>上游输入</dt>
            <dd>{upstream.length ? upstream.map((item) => item.label).join("、") : "项目文件"}</dd>
          </div>
          <div>
            <dt>下游影响</dt>
            <dd>
              {downstream.length
                ? downstream.map((item) => item.label).join("、")
                : "当前节点为终点"}
            </dd>
          </div>
        </dl>
        {node.error && <p className="workflow-node-dialog-error">{node.error}</p>}
      </div>
    </ResponsiveDialog>
  );
}
