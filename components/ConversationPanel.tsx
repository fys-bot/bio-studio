"use client";

import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";

type AgentMode = "标准模式" | "严谨模式" | "快速模式";

type ConversationPanelProps = {
  sentMessages: string[];
  agentReplies: string[];
  taskStatus: string;
  messageText: string;
  agentMode: AgentMode;
  onMessageTextChange: (messageText: string) => void;
  onSendMessage: () => void;
  onAddFile: () => void;
  onAgentModeChange: () => void;
  onOpenFailureEvidence: () => void;
  onOpenCode: () => void;
};

/**
 * 对话面板：承载科研问题、智能体回复和输入编排，不直接管理任务状态。
 * 页面负责注入业务回调，因此后续接入真实流式模型时无需改动视图结构。
 */
export function ConversationPanel({
  sentMessages,
  agentReplies,
  taskStatus,
  messageText,
  agentMode,
  onMessageTextChange,
  onSendMessage,
  onAddFile,
  onAgentModeChange,
  onOpenFailureEvidence,
  onOpenCode,
}: ConversationPanelProps) {
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

  return (
    <div className="conversation">
      {sentMessages.map((messageText, messageIndex) => (
        <div className="user-message sent-message" key={`sent-${messageIndex}-${messageText}`}>
          <small>你 · 刚刚</small>
          <p>{messageText}</p>
        </div>
      ))}
      {agentReplies.map((replyText, replyIndex) => (
        <div className="agent-message reply-message" key={`reply-${replyIndex}-${replyText}`}>
          <div className="assistant-avatar">✦</div>
          <div>
            <small>BioFlow 智能体 · 刚刚</small>
            <p>{replyText}</p>
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
            <button onClick={onOpenFailureEvidence}>查看失败原因</button>
            <button onClick={onOpenCode}>查看生成代码</button>
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
          ＋
        </button>
        <input
          value={messageText}
          onChange={handleMessageChange}
          onKeyDown={handleMessageKeyDown}
          placeholder="继续提问，或要求智能体修改分析参数…"
          aria-label="输入科研问题"
        />
        <button
          type="button"
          className="mode"
          onClick={onAgentModeChange}
          aria-label="切换智能体模式"
        >
          {agentMode}⌄
        </button>
        <button type="submit" aria-label="发送">
          ➤
        </button>
      </form>
    </div>
  );
}
