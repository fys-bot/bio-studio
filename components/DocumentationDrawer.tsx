"use client";

import { useState } from "react";
import { downloadAuthorizedFile } from "@/lib/api-client";

type DocumentationDrawerProps = {
  open: boolean;
  onClose: () => void;
  activeTaskId: string;
};

type DocumentationTab = "guide" | "api" | "frontend" | "rag";

const apiRows = [
  ["POST", "/api/auth/login", "返回 HMAC-SHA256 访问令牌，由前端会话级保存"],
  ["GET", "/api/tasks/:taskId", "读取任务、节点、文件摘要和当前运行"],
  ["POST", "/api/skills", "创建并持久化技能配置"],
  ["GET", "/api/files/:fileId", "读取正文、表格预览和来源定位"],
  ["GET", "/api/files/:fileId/original", "鉴权后下载原文件"],
  ["POST", "/api/tasks/:taskId/analysis", "真实 PyDESeq2 作业提交 / 取消 / 绑定练习文件"],
  ["GET", "/api/tasks/:taskId/analysis", "轮询真实作业状态和统计产物"],
  [
    "POST",
    "/api/files/profile?taskId=:taskId",
    "服务端识别 CSV / TSV / XLSX / PDF / DOCX / TXT / MD",
  ],
  ["POST", "/api/rag/query?taskId=:taskId", "生成当前任务的 RAG Trace"],
  ["POST", "/api/tasks/:taskId/clarifications", "提交四项分析澄清"],
  ["POST", "/api/tasks/:taskId/approve", "审批分析计划"],
  ["POST", "/api/runs?taskId=:taskId", "启动任务运行并返回 runId"],
  ["GET", "/api/runs/:runId/events", "按 runId 推送 SSE 事件"],
  ["GET", "/api/workflows/:id/layout?taskId=:taskId", "读取任务级画布布局"],
];

const steps = [
  ["01", "选择技能", "打开 DESeq2 技能详情，点击使用此技能创建任务，任务将保存技能版本。"],
  ["02", "导入文件", "上传 CSV、TSV、Excel、PDF、DOCX、TXT 或 Markdown，等待服务端处理摘要。"],
  ["03", "确认上下文", "确认数据格式、比较方案、物种和交付物。"],
  ["04", "检查证据", "索引就绪后提问，核对 Qdrant + BM25 / RRF 返回的真实文件片段。"],
  ["05", "审批计划", "确认分析步骤、数据边界和预计产物后批准。"],
  [
    "06",
    "运行与恢复",
    "在输入与计算中选择矩阵、元数据、两组标签，再运行 PyDESeq2；输入错误会返回具体原因。",
  ],
  [
    "07",
    "交付结果",
    "下载 results.csv、volcano.png、report.md 和分析脚本，检查实际 padj 与 log2FC。",
  ],
];

export function DocumentationDrawer({ open, onClose, activeTaskId }: DocumentationDrawerProps) {
  const [activeTab, setActiveTab] = useState<DocumentationTab>("guide");
  if (!open) return null;

  return (
    <div className="documentation-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="documentation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="BioFlow 文档中心"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="documentation-header">
          <div>
            <small>BioFlow STUDIO / DOCUMENTATION</small>
            <h2>文档中心</h2>
            <p>当前任务：{activeTaskId}</p>
          </div>
          <button onClick={onClose} aria-label="关闭文档中心">
            ×
          </button>
        </header>
        <nav className="documentation-tabs" aria-label="文档分类">
          <button
            className={activeTab === "guide" ? "active" : ""}
            onClick={() => setActiveTab("guide")}
          >
            从 0 到 1
          </button>
          <button
            className={activeTab === "api" ? "active" : ""}
            onClick={() => setActiveTab("api")}
          >
            接口文档
          </button>
          <button
            className={activeTab === "frontend" ? "active" : ""}
            onClick={() => setActiveTab("frontend")}
          >
            前端接入
          </button>
          <button
            className={activeTab === "rag" ? "active" : ""}
            onClick={() => setActiveTab("rag")}
          >
            RAG 链路
          </button>
        </nav>
        <div className="documentation-content">
          {activeTab === "guide" && (
            <>
              <div className="documentation-callout">
                <b>推荐演示路径</b>
                <span>示例数据 → 澄清 → 证据 → 审批 → 运行 → 失败恢复 → 结果交付</span>
              </div>
              <div className="documentation-section-head">
                <small>ONBOARDING / 7 STEPS</small>
                <h3>第一次使用智能体</h3>
              </div>
              <div className="documentation-step-list">
                {steps.map(([index, title, detail]) => (
                  <article key={index}>
                    <span>{index}</span>
                    <div>
                      <b>{title}</b>
                      <p>{detail}</p>
                    </div>
                  </article>
                ))}
              </div>
              <div className="documentation-note">
                <b>上传真实文件后会发生什么？</b>
                <p>
                  原文件保存在本机对象目录，正文按页/表格提取和清洗，分块由真实模型生成向量写入
                  Qdrant；授权后可预览正文与下载原件。
                </p>
              </div>
            </>
          )}
          {activeTab === "api" && (
            <>
              <div className="documentation-callout">
                <b>接口边界</b>
                <span>
                  前端请求仅通过 Authorization 携带 Bearer Token，不依赖 Cookie；写接口额外校验同源
                  Origin，运行事件通过 SSE 按 runId 隔离。
                </span>
              </div>
              <div className="documentation-section-head">
                <small>HTTP API / TASK LIFECYCLE</small>
                <h3>核心接口</h3>
                <button
                  onClick={() =>
                    void downloadAuthorizedFile(
                      "/api/research/openapi",
                      "bioflow-research-openapi.json",
                    )
                  }
                >
                  下载 Research Service OpenAPI
                </button>
              </div>
              <div className="api-doc-list">
                {apiRows.map(([method, path, purpose]) => (
                  <article key={`${method}-${path}`}>
                    <span className={`api-method ${method === "GET" ? "get" : "post"}`}>
                      {method}
                    </span>
                    <code>{path}</code>
                    <p>{purpose}</p>
                  </article>
                ))}
              </div>
              <div className="documentation-note">
                <b>SSE 事件示例</b>
                <code>
                  run.started → rag.trace.created → code.delta → node.updated → run.completed
                </code>
              </div>
            </>
          )}
          {activeTab === "frontend" && (
            <>
              <div className="documentation-callout">
                <b>前端接入原则</b>
                <span>
                  页面只通过 bioflowApi 访问接口，组件通过 Props 接收状态，不直接修改 Store。
                </span>
              </div>
              <div className="documentation-section-head">
                <small>FRONTEND / ADAPTER BOUNDARY</small>
                <h3>从页面到服务端</h3>
              </div>
              <div className="frontend-contract-list">
                <article>
                  <b>页面编排</b>
                  <p>
                    <code>app/page.tsx</code> 负责任务路由、澄清、审批、运行、SSE 和面板组合。
                  </p>
                </article>
                <article>
                  <b>接口客户端</b>
                  <p>
                    <code>lib/api-client.ts</code> 统一错误、鉴权失败和请求
                    DTO，组件不拼接业务接口。
                  </p>
                </article>
                <article>
                  <b>真实输入</b>
                  <p>
                    <code>/api/files/profile</code> 转发受保护的解析服务，PDF 使用 pypdf、Excel 使用
                    openpyxl、DOCX 使用 python-docx；预览接口返回受限正文。
                  </p>
                </article>
                <article>
                  <b>可替换能力</b>
                  <p>
                    Agent、Retriever、Reranker、Graph、Compute 和 Structure 都有明确 Adapter
                    边界；当前运行链路可演示，生产接入时替换 Adapter。
                  </p>
                </article>
              </div>
              <div className="documentation-note">
                <b>当前任务上下文</b>
                <code>{activeTaskId}</code>
              </div>
            </>
          )}
          {activeTab === "rag" && (
            <>
              <div className="documentation-callout">
                <b>索引策略</b>
                <span>
                  当前真实文件使用 Qdrant Local Mode 持久化；配置 QDRANT_URL 后使用 Qdrant
                  Server。旧演示 Trace 不作为真实检索结论。
                </span>
              </div>
              <div className="documentation-section-head">
                <small>RAG / INGESTION PIPELINE</small>
                <h3>从文档到证据</h3>
              </div>
              <div className="frontend-contract-list">
                <article>
                  <b>1. 接收与类型识别</b>
                  <p>校验大小、扩展名和文件签名，区分表格、PDF、Office 文档和纯文本。</p>
                </article>
                <article>
                  <b>2. 解析与清洗</b>
                  <p>
                    表格抽取字段和缺失值；文本清理空白；PDF / Office 通过 Parser 或 OCR Adapter
                    提取正文。
                  </p>
                </article>
                <article>
                  <b>3. 语义切块</b>
                  <p>保留文件名、标题、页码、工作表、行列范围等 metadata，避免只存无来源文本。</p>
                </article>
                <article>
                  <b>4. 向量索引</b>
                  <p>
                    FastEmbed / ONNX multilingual MiniLM 生成 384 维真实向量，保留模型名、文件
                    SHA-256、位置与分块序号。
                  </p>
                </article>
                <article>
                  <b>5. 混合召回与审计</b>
                  <p>
                    当前文件范围内执行 BM25 和 cosine 召回，再用 RRF
                    融合。Cross-encoder、真实知识图谱和 LLM 推理尚未启用，不会伪造阶段输出。
                  </p>
                </article>
              </div>
              <div className="documentation-note">
                <b>为什么不是直接把原文塞进向量库？</b>
                <p>
                  科研文档需要保留来源、页码、表格范围、解析器版本和清洗状态；向量只是检索索引，原始文件和结构化元数据仍应保存在对象存储或数据库中。
                </p>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
