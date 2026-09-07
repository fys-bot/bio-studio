"use client";

import { useEffect, useMemo, useState } from "react";

type ProductGuideProps = {
  open: boolean;
  onClose: () => void;
};

type GuideStep = {
  target: string;
  fallbackTarget?: string;
  eyebrow: string;
  title: string;
  description: string;
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
    target: '[data-guide="goal"]',
    eyebrow: "第 1 步 · 先确认目标",
    title: "从研究问题开始",
    description: "顶部目标区会持续显示当前物种、数据类型和交付目标，智能体会用它约束后续分析计划。",
    action: "查看研究目标",
  },
  {
    target: '[data-guide="upload"]',
    fallbackTarget: '[data-guide="files-nav"]',
    eyebrow: "第 2 步 · 导入数据",
    title: "上传数据或研究文档",
    description:
      "上传 CSV、TSV、TXT 或 Markdown 后，服务端会返回字段、缺失值、段落和标题摘要，原始内容不会直接回传到浏览器。",
    action: "定位数据入口",
  },
  {
    target: '[data-guide="evidence"]',
    eyebrow: "第 3 步 · 追踪证据",
    title: "看懂智能体为什么这样决定",
    description:
      "证据流水线把意图识别、RAG 检索、重排和参数绑定串起来。点击任一步，可以在检查器里查看来源。",
    action: "查看证据流水线",
  },
  {
    target: '[data-guide="workflow"]',
    eyebrow: "第 4 步 · 编辑工作流",
    title: "拖拽节点，保存你的分析布局",
    description:
      "打开分析计划后，可以拖动节点、缩放画布、平移视图，并保存布局版本，方便复盘和演示。",
    action: "查看工作流画布",
  },
  {
    target: '[data-guide="run"]',
    eyebrow: "第 5 步 · 运行并交付",
    title: "一键运行，沿途查看结果",
    description:
      "运行后可以切换结果、代码、日志和 3D 结构；失败节点支持重试，结果支持查看血缘并下载报告。",
    action: "定位运行入口",
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
export function ProductGuide({ open, onClose }: ProductGuideProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const activeStep = guideSteps[activeIndex];

  const progressLabel = useMemo(() => `${activeIndex + 1} / ${guideSteps.length}`, [activeIndex]);

  useEffect(() => {
    if (!open) return;
    const savedIndex = Number(window.localStorage.getItem("bioflow-studio-guide-step-v1"));
    setActiveIndex(
      Number.isInteger(savedIndex) && savedIndex >= 0
        ? Math.min(savedIndex, guideSteps.length - 1)
        : 0,
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const updateTarget = () => setTargetRect(measureTarget(activeStep));
    const frame = window.requestAnimationFrame(updateTarget);
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [activeStep, open]);

  if (!open) return null;

  const closeGuide = () => {
    window.localStorage.setItem("bioflow-studio-guide-v1", "dismissed");
    onClose();
  };

  const next = () => {
    if (activeIndex === guideSteps.length - 1) {
      closeGuide();
      return;
    }
    setActiveIndex((index) => {
      const nextIndex = index + 1;
      window.localStorage.setItem("bioflow-studio-guide-step-v1", String(nextIndex));
      return nextIndex;
    });
  };

  const previous = () =>
    setActiveIndex((index) => {
      const previousIndex = Math.max(0, index - 1);
      window.localStorage.setItem("bioflow-studio-guide-step-v1", String(previousIndex));
      return previousIndex;
    });

  const locateTarget = () => {
    const target = resolveTarget(activeStep);
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    window.setTimeout(() => setTargetRect(measureTarget(activeStep)), 280);
  };

  const panelStyle = targetRect
    ? {
        top: Math.min(
          window.innerHeight - 270,
          Math.max(18, targetRect.top + targetRect.height + 16),
        ),
        left: Math.min(window.innerWidth - 370, Math.max(18, targetRect.left)),
      }
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
          <span className="product-guide-kicker">BioFlow Studio · 3 分钟上手</span>
          <button className="product-guide-close" onClick={closeGuide} aria-label="关闭使用指引">
            ×
          </button>
        </div>
        <div className="product-guide-progress">
          <span>{activeStep.eyebrow}</span>
          <b>{progressLabel}</b>
        </div>
        <h2>{activeStep.title}</h2>
        <p>{activeStep.description}</p>
        <div className="product-guide-next-step">
          <span>当前状态</span>
          <b>已定位 · 下一步：{activeStep.action}</b>
        </div>
        <button className="product-guide-locate" onClick={locateTarget}>
          {activeStep.action} ↗
        </button>
        <div className="product-guide-footer">
          <button className="product-guide-skip" onClick={closeGuide}>
            以后再看
          </button>
          <div className="product-guide-actions">
            <button onClick={previous} disabled={activeIndex === 0}>
              上一步
            </button>
            <button className="primary" onClick={next}>
              {activeIndex === guideSteps.length - 1 ? "开始使用" : "下一步"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
