"use client";

import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import GpsFixedRounded from "@mui/icons-material/GpsFixedRounded";
import { Button, IconButton } from "@mui/material";
import { useEffect, useMemo, useState } from "react";

type ProductGuideProps = {
  open: boolean;
  onClose: () => void;
  onShowcaseMenuChange?: (open: boolean) => void;
};

type GuideStep = {
  target: string;
  fallbackTarget?: string;
  eyebrow: string;
  title: string;
  description: string;
  frontend: string;
  backend: string;
  acceptance: string;
  action: string;
};

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const guideSteps: GuideStep[] = [
  {
    target: '[data-guide="showcase-menu"]',
    fallbackTarget: '[data-guide="account-menu-trigger"]',
    eyebrow: "第 1 步 · 选择演示路径",
    title: "先看最能拉开差距的三条主线",
    description:
      "真实计算、文档 RAG 与 3D 结构已经整理成可直接切换的示例任务，面试时不用临时寻找入口。",
    frontend: "首屏任务切换、内容级 Loading、状态恢复",
    backend: "SSE 事件流、Qdrant 检索、PyDESeq2 Worker",
    acceptance: "依次点击三个示例，确认任务上下文与右侧工具同步切换。",
    action: "定位示例任务",
  },
  {
    target: '[data-guide="goal"]',
    eyebrow: "第 2 步 · 先确认目标",
    title: "从研究问题开始",
    description: "顶部目标区会持续显示当前物种、数据类型和交付目标，智能体会用它约束后续分析计划。",
    frontend: "任务状态、主操作与研究目标保持同屏",
    backend: "任务快照从受保护 API 恢复，不依赖前端假状态",
    acceptance: "核对任务标题、执行模式和主按钮是否与当前状态一致。",
    action: "查看研究目标",
  },
  {
    target: '[data-guide="upload"]',
    fallbackTarget: '[data-guide="files-nav"]',
    eyebrow: "第 3 步 · 导入数据",
    title: "上传数据或研究文档",
    description:
      "支持 CSV、TSV、Excel、PDF、DOCX、TXT、Markdown 与图片；不同格式会进入不同解析、清洗和 OCR 策略。",
    frontend: "上传进度、解析状态、原文预览和失败重试",
    backend: "格式路由、结构提取、分块、向量化和 Qdrant 持久化",
    acceptance: "上传一份真实文档，在文件中心打开正文并核对索引状态。",
    action: "定位数据入口",
  },
  {
    target: ".clarification-card",
    fallbackTarget: '[data-guide="goal"]',
    eyebrow: "第 4 步 · 补齐研究条件",
    title: "四项选择决定后续工作流",
    description:
      "数据格式、比较方案、研究物种和交付物会进入计划生成请求，并实时影响节点与计算参数。",
    frontend: "分步澄清、完成度与下一步动作保持可见",
    backend: "澄清答案持久化到任务上下文，并进入 LLM 计划输入",
    acceptance: "完成四项选择，观察主按钮从阻塞状态变为可生成计划。",
    action: "定位澄清区域",
  },
  {
    target: '[data-guide="evidence"]',
    eyebrow: "第 5 步 · 查看实时过程",
    title: "看懂智能体为什么这样决定",
    description:
      "计划生成和真实计算通过 SSE 按步骤持续返回，当前阶段、耗时、错误与事件载荷都可以单独展开。",
    frontend: "增量事件、连接状态、进度条和可展开执行细节",
    backend: "Bearer Token 鉴权的 POST/GET SSE，事件按 runId 隔离",
    acceptance: "生成计划后展开运行过程，确认事件不是一次性拼接出来的最终文本。",
    action: "查看 SSE 过程",
  },
  {
    target: '[data-guide="workflow"]',
    eyebrow: "第 6 步 · 编辑工作流",
    title: "拖拽节点，保存你的分析布局",
    description: "打开工作流后，可以拖动节点、缩放画布、平移视图，并保存布局版本，方便复盘和演示。",
    frontend: "可拖拽节点、平移缩放、影响链高亮和自适应视图",
    backend: "任务级布局自动保存并保留版本与 revision",
    acceptance: "拖动一个节点后刷新页面，确认布局能够恢复。",
    action: "查看工作流画布",
  },
  {
    target: "#real-analysis",
    fallbackTarget: '[data-guide="run"]',
    eyebrow: "第 7 步 · 运行真实计算",
    title: "从输入文件进入 PyDESeq2 Worker",
    description: "绑定计数矩阵和样本元数据、核对实验设计后提交异步计算，刷新页面仍可恢复作业状态。",
    frontend: "输入校验、计算状态、火山图与产物下载",
    backend: "SQLite 作业队列、独立 Python Worker 与真实 PyDESeq2",
    acceptance: "载入示例输入并运行，等待 SSE 显示 analysis.completed。",
    action: "定位真实计算",
  },
  {
    target: ".tool-dock",
    fallbackTarget: '[data-guide="run"]',
    eyebrow: "第 8 步 · 检查并交付",
    title: "在同一任务中核对证据、代码、结果和 3D",
    description: "右侧研究工具聚合审计信息，所有结果都应能回到来源文件、工作流节点或执行事件。",
    frontend: "结果血缘、代码流、RAG Trace 与交互式 3D",
    backend: "产物下载受鉴权保护，文件与任务上下文隔离",
    acceptance: "分别打开证据、代码、结果和 3D，检查是否仍属于当前任务。",
    action: "定位研究工具",
  },
];

function resolveTarget(step: GuideStep): Element | null {
  const primary = document.querySelector(step.target);
  if (primary && (primary as HTMLElement).offsetParent !== null) return primary;
  return step.fallbackTarget ? document.querySelector(step.fallbackTarget) : primary;
}

function measureTarget(step: GuideStep): TargetRect | null {
  const target = resolveTarget(step);
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    top: Math.max(8, rect.top - 7),
    left: Math.max(8, rect.left - 7),
    width: Math.min(window.innerWidth - 16, rect.width + 14),
    height: Math.min(window.innerHeight - 16, rect.height + 14),
  };
}

/**
 * 首次访问引导：只负责定位和解释真实界面，不替用户执行危险操作。
 * 引导状态由页面控制，便于用户从顶部入口重新打开。
 */
export function ProductGuide({ open, onClose, onShowcaseMenuChange }: ProductGuideProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const activeStep = guideSteps[activeIndex];

  const progressLabel = useMemo(() => `${activeIndex + 1} / ${guideSteps.length}`, [activeIndex]);

  useEffect(() => {
    if (!open) return;
    const savedIndex = Number(window.localStorage.getItem("bioflow-studio-guide-step-v2"));
    setActiveIndex(
      Number.isInteger(savedIndex) && savedIndex >= 0
        ? Math.min(savedIndex, guideSteps.length - 1)
        : 0,
    );
  }, [open]);

  useEffect(() => {
    onShowcaseMenuChange?.(open && activeIndex === 0);
    return () => {
      if (open && activeIndex === 0) onShowcaseMenuChange?.(false);
    };
  }, [activeIndex, onShowcaseMenuChange, open]);

  useEffect(() => {
    if (!open) return;
    const updateTarget = () => setTargetRect(measureTarget(activeStep));
    const frame = window.requestAnimationFrame(updateTarget);
    const menuFrame = window.setTimeout(updateTarget, 80);
    const layoutFrame = window.setTimeout(updateTarget, 220);
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(menuFrame);
      window.clearTimeout(layoutFrame);
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [activeStep, open]);

  if (!open) return null;

  const closeGuide = () => {
    window.localStorage.setItem("bioflow-studio-guide-v2", "dismissed");
    onClose();
  };

  const next = () => {
    if (activeIndex === guideSteps.length - 1) {
      closeGuide();
      return;
    }
    setActiveIndex((index) => {
      const nextIndex = index + 1;
      window.localStorage.setItem("bioflow-studio-guide-step-v2", String(nextIndex));
      return nextIndex;
    });
  };

  const previous = () =>
    setActiveIndex((index) => {
      const previousIndex = Math.max(0, index - 1);
      window.localStorage.setItem("bioflow-studio-guide-step-v2", String(previousIndex));
      return previousIndex;
    });

  const locateTarget = () => {
    const target = resolveTarget(activeStep);
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    window.setTimeout(() => setTargetRect(measureTarget(activeStep)), 280);
  };

  const panelStyle = targetRect
    ? (() => {
        const panelHeight = Math.min(540, window.innerHeight - 36);
        const below = targetRect.top + targetRect.height + 16;
        const above = targetRect.top - panelHeight - 16;
        return {
          top: Math.max(18, below + panelHeight <= window.innerHeight ? below : above),
          left: Math.min(window.innerWidth - 438, Math.max(18, targetRect.left)),
        };
      })()
    : undefined;

  return (
    <div className="product-guide" role="dialog" aria-modal="true" aria-label="BioFlow 使用指引">
      <button className="product-guide-scrim" aria-label="跳过使用指引" onClick={closeGuide} />
      {targetRect && (
        <div
          className="product-guide-highlight"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
          aria-hidden="true"
        />
      )}
      <section className="product-guide-panel" style={panelStyle}>
        <div className="product-guide-header">
          <span className="product-guide-kicker">BioFlow Studio · 从 0 到 1 验收指引</span>
          <IconButton
            className="product-guide-close"
            onClick={closeGuide}
            aria-label="关闭使用指引"
          >
            <CloseRounded sx={{ fontSize: 18 }} />
          </IconButton>
        </div>
        <div className="product-guide-progress">
          <span>{activeStep.eyebrow}</span>
          <b>{progressLabel}</b>
        </div>
        <h2>{activeStep.title}</h2>
        <p>{activeStep.description}</p>
        <div className="product-guide-capabilities">
          <article>
            <span>前端交互</span>
            <b>{activeStep.frontend}</b>
          </article>
          <article>
            <span>服务能力</span>
            <b>{activeStep.backend}</b>
          </article>
        </div>
        <div className="product-guide-next-step">
          <span>本步验收</span>
          <b>{activeStep.acceptance}</b>
        </div>
        <Button
          className="product-guide-locate"
          size="small"
          startIcon={<GpsFixedRounded />}
          onClick={locateTarget}
        >
          {activeStep.action}
        </Button>
        <div className="product-guide-footer">
          <button className="product-guide-skip" onClick={closeGuide}>
            以后再看
          </button>
          <div className="product-guide-actions">
            <Button
              size="small"
              startIcon={<ArrowBackRounded />}
              onClick={previous}
              disabled={activeIndex === 0}
            >
              上一步
            </Button>
            <Button
              className="primary"
              size="small"
              endIcon={<ArrowForwardRounded />}
              onClick={next}
            >
              {activeIndex === guideSteps.length - 1 ? "开始使用" : "下一步"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
