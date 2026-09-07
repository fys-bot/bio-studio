"use client";

import { ArrowRight, Database } from "lucide-react";

export type ClarificationKey = "format" | "comparison" | "organism" | "deliverable";

export type ClarificationAnswers = Record<ClarificationKey, string>;

export type ClarificationQuestion = {
  key: ClarificationKey;
  number: string;
  label: string;
  description: string;
  options: readonly (readonly [string, string])[];
};

export const clarificationQuestions: readonly ClarificationQuestion[] = [
  {
    key: "format",
    number: "01",
    label: "数据格式",
    description: "决定从原始读段、比对结果还是计数矩阵开始。",
    options: [
      ["Count 矩阵", "直接进入 DESeq2，适合当前演示"],
      ["FASTQ 文件", "增加质控、比对和定量步骤"],
      ["公共数据库", "从 GEO / SRA 获取数据"],
    ],
  },
  {
    key: "comparison",
    number: "02",
    label: "比较方案",
    description: "决定设计矩阵、对比项和统计模型。",
    options: [
      ["处理组 vs 对照组", "单一对比，路径最清晰"],
      ["多组比较", "生成多个 contrasts"],
      ["时间序列", "使用时间效应模型"],
    ],
  },
  {
    key: "organism",
    number: "03",
    label: "研究物种",
    description: "决定参考基因组与基因注释版本。",
    options: [
      ["人类", "GRCh38 / GENCODE"],
      ["小鼠", "GRCm39 / GENCODE"],
      ["大鼠", "mRatBN7.2 / Ensembl"],
    ],
  },
  {
    key: "deliverable",
    number: "04",
    label: "交付物",
    description: "决定图表、表格和报告的完整程度。",
    options: [
      ["探索性分析", "快速结果与火山图"],
      ["可发表结果", "补充 QC、热图和方法说明"],
      ["完整科研报告", "输出图表、代码与报告"],
    ],
  },
];

type ClarificationCardProps = {
  answers: ClarificationAnswers;
  activeQuestion: number;
  submitting?: boolean;
  onActiveQuestionChange: (index: number) => void;
  onAnswer: (key: ClarificationKey, value: string, index: number) => void;
  onSubmit: () => void;
  onUseDemoData?: () => void;
};

export function ClarificationCard({
  answers,
  activeQuestion,
  submitting = false,
  onActiveQuestionChange,
  onAnswer,
  onSubmit,
  onUseDemoData,
}: ClarificationCardProps) {
  const completed = Object.values(answers).filter(Boolean).length;
  const question = clarificationQuestions[activeQuestion];

  return (
    <div className="gate-card clarification-card">
      <div className="gate-head">
        <div>
          <small>智能体需要补充信息</small>
          <h2>先确认这次实验的分析上下文</h2>
          <p>每项选择都会实时影响后续分析路径。</p>
        </div>
        <span className="gate-progress">已完成 {completed} / 4</span>
      </div>
      <div className="question-nav">
        {clarificationQuestions.map((item, index) => (
          <button
            key={item.key}
            disabled={submitting}
            className={`${activeQuestion === index ? "active" : ""} ${
              answers[item.key] ? "answered" : ""
            }`}
            onClick={() => onActiveQuestionChange(index)}
          >
            <span>{answers[item.key] ? "✓" : item.number}</span>
            {item.label}
          </button>
        ))}
      </div>
      <section className="question-panel" key={question.key}>
        <div className="question-copy">
          <small>{question.number} / 04</small>
          <h3>{question.label}</h3>
          <p>{question.description}</p>
        </div>
        <div className="option-cards">
          {question.options.map(([value, hint]) => (
            <button
              key={value}
              disabled={submitting}
              className={answers[question.key] === value ? "selected" : ""}
              onClick={() => onAnswer(question.key, value, activeQuestion)}
            >
              <i>{answers[question.key] === value ? "●" : "○"}</i>
              <span>
                <b>{value}</b>
                <small>{hint}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
      <div className="clarification-actions">
        <div className="clarification-action-copy">
          <b>{completed < 4 ? `还需完成 ${4 - completed} 项` : "分析上下文已完整"}</b>
          <span>
            {completed < 4 ? "也可以载入示例输入后再调整" : "下一步将调用 LLM 生成可审批计划"}
          </span>
        </div>
        <div className="clarification-action-buttons">
          {onUseDemoData && (
            <button
              className="secondary demo-data-button"
              disabled={submitting}
              onClick={onUseDemoData}
            >
              <Database size={15} />
              <span>
                <b>载入示例输入</b>
                <small>Count 矩阵与样本元数据</small>
              </span>
            </button>
          )}
          <button
            className="primary"
            onClick={onSubmit}
            disabled={submitting || Object.values(answers).some((value) => !value)}
          >
            {submitting ? "正在生成计划…" : "生成分析计划"}
            {!submitting && <ArrowRight size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
