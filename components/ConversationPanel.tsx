"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import ManageSearchRounded from "@mui/icons-material/ManageSearchRounded";
import ScienceRounded from "@mui/icons-material/ScienceRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import SpeedRounded from "@mui/icons-material/SpeedRounded";
import { Button, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { useState, type MouseEvent } from "react";
import type { ConversationMessage } from "@/lib/domain";
import { AGENT_MODE_OPTIONS, type AgentMode } from "@/lib/agent-mode";

type ConversationPanelProps = {
  messages: ConversationMessage[];
  taskStatus: string;
  messageText: string;
  agentMode: AgentMode;
  onMessageTextChange: (messageText: string) => void;
  onSendMessage: () => void;
  onAddFile: () => void;
  onAgentModeChange: (mode: AgentMode) => void;
  onOpenFailureEvidence: () => void;
  onOpenCode: () => void;
  onCopyMessage: (content: string) => void;
  onRetryMessage: (content: string) => void;
  onOpenTrace: (traceId?: string) => void;
  onCitationClick: (citationId: string, traceId?: string) => void;
  onFeedback: (messageId: string, feedback: "up" | "down") => void;
  onFollowUp: (question: string) => void;
};

function renderInlineMarkdown(
  content: string,
  citations: ConversationMessage["citations"],
  onCitationClick: (citationId: string) => void,
) {
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g).filter(Boolean);
  return parts.map((part, index) => {
    const citationMatch = part.match(/^\[(\d+)\]$/);
    if (citationMatch) {
      const citation = citations?.[Number(citationMatch[1]) - 1];
      if (!citation) return <span key={`${part}-${index}`}>{part}</span>;
      return (
        <button
          className="message-citation"
          key={`${part}-${index}`}
          type="button"
          title={citation.detail || citation.label}
          onClick={() => onCitationClick(citation.id)}
        >
          {part}
        </button>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function MessageBody({
  message,
  onCitationClick,
}: {
  message: ConversationMessage;
  onCitationClick: (citationId: string) => void;
}) {
  return (
    <div className="message-body">
      {message.content.split("\n").map((line, index) => (
        <p key={`${message.id}-line-${index}`}>
          {renderInlineMarkdown(line, message.citations, onCitationClick)}
        </p>
      ))}
    </div>
  );
}

/**
 * 消息级 Agent 交互：每条消息都拥有自己的状态、Trace 和引用，避免用数组下标
 * 把用户问题与异步 RAG 结果错误地绑定在一起。
 */
export function ConversationPanel({
  messages,
  taskStatus,
  messageText,
  agentMode,
  onMessageTextChange,
  onSendMessage,
  onAddFile,
  onAgentModeChange,
  onOpenFailureEvidence,
  onOpenCode,
  onCopyMessage,
  onRetryMessage,
  onOpenTrace,
  onCitationClick,
  onFeedback,
  onFollowUp,
}: ConversationPanelProps) {
  const [modeAnchor, setModeAnchor] = useState<HTMLElement | null>(null);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSendMessage();
  };

  const handleMessageChange = (event: ChangeEvent<HTMLInputElement>) => {
    onMessageTextChange(event.target.value);
  };

  const handleMessageKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSendMessage();
    }
  };

  const followUpQuestions = ["解释这个参数为什么适合当前实验设计", "查看候选基因的结构证据"];
  const selectedMode =
    AGENT_MODE_OPTIONS.find((option) => option.value === agentMode) ?? AGENT_MODE_OPTIONS[1];
  const modeIcon = (mode: AgentMode) => {
    if (mode === "快速模式") return <SpeedRounded fontSize="small" />;
    if (mode === "深度研究") return <ManageSearchRounded fontSize="small" />;
    return <ScienceRounded fontSize="small" />;
  };

  return (
    <div className="conversation">
      {messages.map((message) => (
        <div
          className={`${message.role === "user" ? "user-message sent-message" : "agent-message reply-message"} ${message.status === "failed" ? "message-failed" : ""}`}
          key={message.id}
        >
          {message.role === "assistant" && <div className="assistant-avatar">✦</div>}
          <div className="message-content">
            <small>
              {message.role === "user" ? "你" : "BioFlow 智能体"} ·{" "}
              {message.status === "sending" ? "生成中" : "刚刚"}
            </small>
            <MessageBody
              message={message}
              onCitationClick={(id) => onCitationClick(id, message.traceId)}
            />
            {message.status === "sending" && (
              <span className="message-progress">正在检索证据并绑定分析参数…</span>
            )}
            {message.status === "failed" && (
              <span className="message-progress">生成失败，可以重新发送。</span>
            )}
            <div className="message-actions">
              <button type="button" onClick={() => onCopyMessage(message.content)} title="复制消息">
                复制
              </button>
              {message.role === "user" && (
                <button
                  type="button"
                  onClick={() => onRetryMessage(message.content)}
                  title="重新发送"
                >
                  重新分析
                </button>
              )}
              {message.role === "assistant" && (
                <>
                  <button type="button" onClick={() => onOpenTrace(message.traceId)}>
                    {message.traceId ? "查看 Trace" : "等待 Trace"}
                  </button>
                  <button
                    type="button"
                    className={message.feedback === "up" ? "selected" : ""}
                    onClick={() => onFeedback(message.id, "up")}
                    aria-label="对回复点赞"
                  >
                    好
                  </button>
                  <button
                    type="button"
                    className={message.feedback === "down" ? "selected" : ""}
                    onClick={() => onFeedback(message.id, "down")}
                    aria-label="对回复点踩"
                  >
                    需改进
                  </button>
                </>
              )}
            </div>
            {message.role === "assistant" && message.status === "completed" && (
              <div className="follow-up-list" aria-label="后续问题建议">
                {followUpQuestions.map((question) => (
                  <button type="button" key={question} onClick={() => onFollowUp(question)}>
                    {question} →
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      {taskStatus === "failed" && (
        <div className="message failure-message">
          <small>BioFlow 智能体 · 刚刚</small>
          <p>
            在运行 DESeq2 前发现元数据问题：映射中缺少 <code>condition</code> 字段，4
            个下游产物已暂停。
          </p>
          <div className="message-actions">
            <button type="button" onClick={onOpenFailureEvidence}>
              查看失败原因
            </button>
            <button type="button" onClick={onOpenCode}>
              查看生成代码
            </button>
          </div>
        </div>
      )}
      <form className="composer" onSubmit={handleSubmit}>
        <button
          type="button"
          className="composer-add"
          aria-label="添加项目文件"
          onClick={onAddFile}
        >
          <AddRounded sx={{ fontSize: 19 }} />
        </button>
        <input
          value={messageText}
          onChange={handleMessageChange}
          onKeyDown={handleMessageKeyDown}
          placeholder="继续提问，或要求智能体修改分析参数…"
          aria-label="输入科研问题"
        />
        <Button
          className="mode"
          onClick={(event: MouseEvent<HTMLButtonElement>) => setModeAnchor(event.currentTarget)}
          aria-label={`当前为${agentMode}，打开智能体模式菜单`}
          aria-haspopup="menu"
          aria-expanded={Boolean(modeAnchor)}
          endIcon={<ExpandMoreRounded sx={{ fontSize: 16 }} />}
        >
          <span className="composer-mode-copy">
            <b>{agentMode}</b>
            <small>reasoning: {selectedMode.effort}</small>
          </span>
        </Button>
        <Menu
          className="agent-mode-menu"
          anchorEl={modeAnchor}
          open={Boolean(modeAnchor)}
          onClose={() => setModeAnchor(null)}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          {AGENT_MODE_OPTIONS.map((option) => (
            <MenuItem
              key={option.value}
              selected={option.value === agentMode}
              onClick={() => {
                onAgentModeChange(option.value);
                setModeAnchor(null);
              }}
            >
              <ListItemIcon>{modeIcon(option.value)}</ListItemIcon>
              <ListItemText primary={option.label} secondary={option.description} />
              <span className="agent-mode-effort">{option.effort}</span>
            </MenuItem>
          ))}
        </Menu>
        <button type="submit" aria-label="发送">
          <SendRounded sx={{ fontSize: 17 }} />
        </button>
      </form>
    </div>
  );
}
