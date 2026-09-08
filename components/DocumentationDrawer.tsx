"use client";

import CloseRounded from "@mui/icons-material/CloseRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Chip,
  IconButton,
} from "@mui/material";
import { useState } from "react";
import { downloadAuthorizedFile } from "@/lib/api-client";

type DocumentationDrawerProps = {
  open: boolean;
  onClose: () => void;
  activeTaskId: string;
};

type DocumentationTab = "guide" | "architecture" | "api" | "frontend" | "rag" | "data";

type AtomicSection = {
  id: string;
  title: string;
  summary: string;
  items: Array<[string, string]>;
};

const guideSteps = [
  {
    index: "01",
    title: "选择面试演示主线",
    detail: "从首屏亮点示例选择真实计算 + SSE、文档 RAG 或 3D 结构，系统会切换到对应任务。",
    expected: "任务标题、研究目标和右侧工具上下文同步变化。",
    failure: "若只看到全屏 Loading，检查任务 API 与 Bearer Token；切换任务不应刷新整个页面。",
  },
  {
    index: "02",
    title: "上传真实文件",
    detail: "支持 CSV、TSV、XLSX、PDF、DOCX、TXT、MD、PNG 和 JPG；上传后进入格式路由与解析队列。",
    expected: "文件中心显示解析器、字符数、索引状态、正文预览和原文件下载。",
    failure: "文件服务异常时运行 npm run services；页面固定使用 3000 端口，无需换端口。",
  },
  {
    index: "03",
    title: "完成四项研究澄清",
    detail: "确认数据格式、比较方案、物种和交付物；这些字段会进入计划生成和后续计算参数。",
    expected: "完成度达到 4/4，主按钮允许生成分析计划。",
    failure: "按钮仍不可用时，逐项检查是否存在空值，不要绕过前端校验直接运行。",
  },
  {
    index: "04",
    title: "观察计划 SSE",
    detail: "生成计划后，运行过程会持续展示上下文校验、Worker 调用、LLM 响应和计划持久化。",
    expected: "可以看到多个按时间到达的事件，并展开 payload，而不是只看到最终回答。",
    failure: "503 优先检查 Worker 健康版本和 LLM 配置；事件流会明确标记失败阶段。",
  },
  {
    index: "05",
    title: "检查并编辑工作流",
    detail: "展开画布后拖动节点、平移、缩放和保存版本；节点状态与任务运行状态分离。",
    expected: "布局自动保存，刷新任务后位置与 revision 能够恢复。",
    failure: "无法拖动先确认事件发生在画布空白或节点标题区域，移动端使用单指拖动。",
  },
  {
    index: "06",
    title: "审批并运行真实计算",
    detail: "绑定 Count 矩阵与样本元数据，确认 condition、control、treated 和可选 batch 后运行。",
    expected: "PyDESeq2 作业进入队列，SSE 依次显示 queued、running 和 completed。",
    failure: "输入不匹配会返回具体样本或字段错误，不会用固定结果冒充成功。",
  },
  {
    index: "07",
    title: "核对结果与证据血缘",
    detail: "在研究工具中查看证据、日志、代码、火山图、报告与 3D 结构，并回到来源节点。",
    expected: "结果可以下载，候选基因、代码和证据仍绑定当前 taskId/runId。",
    failure: "若内容属于其他任务，记录当前路由并检查任务切换后的状态清理。",
  },
];

const architectureSections: AtomicSection[] = [
  {
    id: "auth",
    title: "身份鉴权与角色边界",
    summary: "无 Cookie 的 Bearer Token、HMAC 签名和服务重启失效策略。",
    items: [
      ["前端", "令牌只保存在 sessionStorage，由 authorizedFetch 统一注入 Authorization。"],
      ["服务端", "登录接口校验同源、账号密码和角色，受保护 API 统一验证签名与过期时间。"],
      [
        "当前角色",
        "研究员、审阅者和管理员均已实现；管理员可新增用户、分配角色、细调权限和停用账号。",
      ],
      ["验收", "清除令牌后访问 / 或 /files 必须跳转 /login；伪造 Token 返回 401。"],
    ],
  },
  {
    id: "task-agent",
    title: "任务与智能体编排",
    summary: "任务快照、澄清、计划审批、运行和失败恢复构成主状态机。",
    items: [
      ["入口", "app/page.tsx 组合任务路由、澄清、计划、运行、工具抽屉与结果交付。"],
      ["状态", "draft → clarifying → awaiting_approval → queued/running → succeeded/failed。"],
      ["持久化", "服务端 Store 保存任务、对话、笔记、布局、运行事件与产物引用。"],
      ["边界", "前端不直接修改 Store，所有状态变化通过 lib/api-client.ts 的 DTO 调用。"],
    ],
  },
  {
    id: "sse",
    title: "SSE 流式执行过程",
    summary: "计划生成与真实计算均按步骤流式输出，并提供可展开审计载荷。",
    items: [
      ["计划流", "POST /api/agent/plan 在同一响应中推送 Worker、LLM、持久化与完成事件。"],
      ["运行流", "GET /api/runs/:runId/events 使用 Last-Event-ID 支持恢复与事件去重。"],
      ["计算流", "GET /api/tasks/:taskId/analysis?stream=1 持续推送 PyDESeq2 作业状态。"],
      ["前端", "RunStreamTrace 展示连接状态、进度、当前步骤、事件时间与原始 payload。"],
    ],
  },
  {
    id: "documents",
    title: "文档解析与 RAG",
    summary: "格式策略路由、结构化清洗、分块、向量索引和混合召回。",
    items: [
      ["解析", "PDF 使用 pypdf + OCR 路由，Excel 使用 openpyxl，DOCX 使用 python-docx。"],
      ["索引", "FastEmbed 生成真实向量，Qdrant Local Mode 默认本地持久化。"],
      ["检索", "在任务 fileIds 范围内执行 BM25 + cosine，再使用 RRF 融合。"],
      ["审计", "每个片段保留文件、页码/工作表、解析器、分块位置和分数。"],
    ],
  },
  {
    id: "compute",
    title: "真实统计计算",
    summary: "独立 Python Worker、SQLite 作业队列和 PyDESeq2 结果产物。",
    items: [
      ["输入", "Count 矩阵、样本元数据、分组字段、比较方向、批次与 FDR 阈值。"],
      ["执行", "作业由独立进程运行，刷新页面后可以恢复 queued/running/succeeded 状态。"],
      ["产物", "results.csv、volcano.png、report.md 与 analysis.py。"],
      ["诚实边界", "当前使用 PyDESeq2；与 R DESeq2 不承诺逐值完全一致。"],
    ],
  },
  {
    id: "canvas-structure",
    title: "工作流画布与 3D 结构",
    summary: "前端亮点不是静态截图，而是与任务上下文联动的交互工具。",
    items: [
      ["画布", "节点拖拽、画布平移、滚轮缩放、自动适配、影响链高亮与布局版本。"],
      ["3D", "蛋白结构支持旋转、缩放、残基选择与证据联动。"],
      ["数据", "节点和结构状态来自任务/结构 Adapter，不使用 DOM 位置表达业务状态。"],
      ["边界", "当前为轻量结构渲染器，完整 Mol* 仍保留 Adapter 接入口。"],
    ],
  },
  {
    id: "quality",
    title: "恢复策略与质量门禁",
    summary: "错误必须可定位、可重试、可解释，且不能用演示数据掩盖真实失败。",
    items: [
      ["前端门禁", "TypeScript、Prettier、Next build 与多端浏览器截图检查。"],
      ["服务门禁", "Parser 单测、集成 Smoke、Worker health apiVersion 与 feature 探测。"],
      ["恢复", "SSE 重连、失败节点重试、文件重新解析、任务状态和画布布局恢复。"],
      ["数据边界", "真实结果、演示种子与 Adapter 能力在界面和文档中明确区分。"],
    ],
  },
  {
    id: "persistence",
    title: "本机持久化与生产迁移",
    summary: "当前不是无数据库，而是为面试机设计的 JSON + SQLite + Qdrant + 文件混合存储。",
    items: [
      ["任务域", "data/state.json 保存任务、对话、笔记、布局、运行事件和 RAG Trace。"],
      [
        "科研域",
        "research.sqlite 保存文档/作业记录，Qdrant Local 保存真实向量，objects/jobs 保存原件与产物。",
      ],
      ["账号与项目", "auth-users.json 保存 scrypt 哈希和权限；projects.json 保存项目目录。"],
      [
        "生产目标",
        "PostgreSQL + 对象存储 + Qdrant Server + 专用队列 Worker；应用内可下载完整 DDL。",
      ],
    ],
  },
];

const apiGroups: AtomicSection[] = [
  {
    id: "api-auth",
    title: "1. 鉴权与用户",
    summary: "Bearer 会话、三角色登录和管理员用户权限闭环。",
    items: [
      ["POST /api/auth/login", "校验账号、密码、角色和 Origin，返回 HMAC-SHA256 访问令牌。"],
      ["GET /api/auth/session", "验证令牌签名、角色与过期时间，并恢复当前会话。"],
      ["POST /api/auth/logout", "前端清除 sessionStorage 中的访问令牌。"],
      ["GET/POST/PATCH /api/admin/users", "管理员读取、新增、分配角色/权限、重置密码和停用用户。"],
    ],
  },
  {
    id: "api-project-task",
    title: "2. 项目与任务",
    summary: "项目目录、任务状态机、澄清、审批、对话与笔记。",
    items: [
      ["GET/POST/DELETE /api/projects", "读取、新建和二次确认后删除项目目录。"],
      ["GET/DELETE /api/tasks/:taskId", "读取或删除任务、节点、文件、运行与产物快照。"],
      ["POST /api/tasks", "创建真实任务，可绑定 skillId、fileIds 和 executionMode。"],
      ["POST /api/tasks/:taskId/clarifications", "提交四项研究上下文。"],
      ["POST /api/tasks/:taskId/approve", "批准计划并解除真实计算阻塞。"],
      ["GET/PUT /api/tasks/:taskId/conversation", "读取和保存任务级对话。"],
      ["GET/PUT /api/tasks/:taskId/notes", "读取和保存任务级研究笔记或审阅意见。"],
    ],
  },
  {
    id: "api-files",
    title: "3. 文件与解析",
    summary: "上传、预览、重新解析、下载和原件/索引安全删除。",
    items: [
      ["GET /api/files", "读取真实 Research Worker 文档目录。"],
      ["POST /api/files/profile?taskId=:taskId", "上传并按格式策略解析、清洗、分块和索引。"],
      ["GET /api/files/:fileId", "读取受限正文、表格、解析器与索引状态。"],
      ["GET /api/files/:fileId/original", "鉴权后内联预览或下载原文件。"],
      ["POST /api/files/:fileId/reparse", "重新执行解析与索引。"],
      ["DELETE /api/files/:fileId", "同步删除 SQLite 记录、Qdrant 向量、原件与任务绑定。"],
    ],
  },
  {
    id: "api-rag",
    title: "4. RAG",
    summary: "任务文件范围内的混合检索和分阶段审计。",
    items: [
      ["GET/POST /api/rag/query", "查询 Trace 历史或执行 Qdrant + BM25 + RRF。"],
      ["GET /api/rag/traces/:traceId", "读取完整 Trace、来源、分数和最终决策。"],
      [
        "GET /api/rag/traces/:traceId/:stage",
        "按 documents/chunks/retrieval/rerank/graph/grounding/tools 查看。",
      ],
      ["GET /api/rag/traces/:traceId/events", "以一次性 SSE 读取已完成 Trace。"],
    ],
  },
  {
    id: "api-plan",
    title: "5. Agent 计划与 SSE",
    summary: "真实模型计划、等待心跳、失败定位和任务持久化。",
    items: [
      ["POST /api/agent/plan", "JSON 或 SSE；推送校验、Worker、LLM 回退、等待、持久化和完成事件。"],
      ["Agent mode", "快速/标准/深度研究分别传递 low/medium/high reasoning effort。"],
      ["错误合同", "建立流后通过 plan.failed 返回 attempts、code、hint 和失败阶段。"],
    ],
  },
  {
    id: "api-runs",
    title: "6. 运行与计算",
    summary: "运行实例、事件恢复、真实计算和产物下载。",
    items: [
      ["POST /api/runs?taskId=:taskId", "创建工作流运行并返回 runId。"],
      ["GET /api/runs/:runId/events", "按 runId 推送 SSE，支持 Last-Event-ID。"],
      ["POST /api/runs/:runId/cancel", "取消当前运行。"],
      ["POST /api/runs/:runId/nodes/:nodeId/retry", "重试失败节点。"],
      ["POST/GET /api/tasks/:taskId/analysis", "提交、查询、取消和流式跟踪 PyDESeq2。"],
      [
        "GET /api/tasks/:taskId/analysis/:name",
        "下载 results.csv、volcano.png、report.md 与 analysis.py。",
      ],
    ],
  },
  {
    id: "api-skill-layout",
    title: "7. 技能与工作流布局",
    summary: "技能目录、声明式创建、启停和画布版本。",
    items: [
      ["GET/POST /api/skills", "搜索分页技能或由管理员创建声明式技能。"],
      ["GET/PATCH /api/skills/:skillId", "读取技能详情或修改启用状态。"],
      ["GET/PUT/POST /api/workflows/:id/layout", "读取、自动保存和创建画布布局版本。"],
      ["GET /api/structures/:accession", "读取 PDB/CIF 结构 Adapter 状态和降级结果。"],
    ],
  },
  {
    id: "api-diagnostics",
    title: "8. 演示与诊断",
    summary: "受控演示配置、重置、测试清理和交付文档。",
    items: [
      ["GET/POST /api/demo/config", "读取或更新演示配置。"],
      ["POST /api/demo/reset / cleanup", "仅开发环境重置演示或由管理员清理集成夹具。"],
      ["GET /api/research/openapi", "下载 FastAPI Research Service OpenAPI。"],
      ["GET /api/docs/:document", "下载完整 API Markdown 或 PostgreSQL DDL。"],
    ],
  },
];

const frontendSections: AtomicSection[] = [
  {
    id: "front-shell",
    title: "路由壳层与响应式导航",
    summary: "工作台、能力中心和文件中心共享身份与一级导航。",
    items: [
      ["组件", "AuthSessionGate、GlobalRail、ModuleShell、ModuleContent。"],
      ["Loading", "首次会话使用全页 Loading；任务、技能和文件切换只使用内容区 Loading。"],
      ["响应式", "桌面侧栏、中屏压缩和移动端双层底栏使用明确断点与安全区。"],
      ["验收", "切换模块后导航不消失、内容回到顶部、分页保持可见。"],
    ],
  },
  {
    id: "front-data",
    title: "API 客户端与状态边界",
    summary: "组件不直接拼业务请求，错误与令牌由统一客户端处理。",
    items: [
      ["文件", "lib/api-client.ts 封装 JSON、SSE、下载、错误码和 Authorization。"],
      ["状态", "页面保存编排状态，展示组件只通过 Props 接收数据与回调。"],
      ["错误", "401、403、404、校验错误和服务错误转换为一致中文提示。"],
      ["超时", "普通请求、文件解析、RAG 和 LLM 计划使用不同超时窗口。"],
    ],
  },
  {
    id: "front-components",
    title: "关键交互组件",
    summary: "核心亮点对应独立组件，便于测试和替换实现。",
    items: [
      ["工作流", "WorkflowCanvas 负责节点、边、缩放、平移和布局状态。"],
      ["流式过程", "RunStreamTrace 负责 SSE 连接、事件摘要、进度和审计详情。"],
      ["文件", "FileCatalog + FilePreview 负责搜索、筛选、分页、预览和下载。"],
      ["科研结果", "RealAnalysisPanel、ResultsPanel、ProteinStructureViewer 负责真实计算与交付。"],
    ],
  },
  {
    id: "front-test",
    title: "本地启动与测试",
    summary: "面试电脑只需要一个前端端口，脚本负责启动并探测 Worker。",
    items: [
      ["启动", "npm install 后运行 npm run dev，浏览器固定访问 http://127.0.0.1:3000。"],
      ["类型", "npm run typecheck。"],
      ["解析器", "npm run test:parsers。"],
      ["端到端", "npm run smoke；完整构建使用 npm run test。"],
    ],
  },
];

const ragSections: AtomicSection[] = [
  {
    id: "rag-route",
    title: "1. 文件类型与策略路由",
    summary: "先判断文件可提取性，再选择表格、文本、Office、PDF 或视觉 OCR。",
    items: [
      ["表格", "CSV/TSV/XLSX 抽取字段、行列、缺失值和候选分组列。"],
      ["PDF", "先使用 pypdf 提取文本；扫描页或低文本页进入 OCR Adapter。"],
      ["DOCX", "服务端 python-docx 提取结构，前端 docx-preview 还原版式。"],
      ["图片", "保留原图预览；配置视觉 OCR 模型后提取正文。"],
    ],
  },
  {
    id: "rag-clean",
    title: "2. 清洗、分段与 Metadata",
    summary: "向量不是原文仓库，片段必须保留定位信息和解析历史。",
    items: [
      ["清洗", "统一空白、去除重复噪声、限制异常超长内容。"],
      ["分段", "按标题、段落、页面和表格边界切块，避免固定字符粗切。"],
      ["Metadata", "保留 fileId、文件名、页码、工作表、行列范围、解析器和 chunkIndex。"],
      ["原文", "原文件保存在本地对象目录，向量库只保存检索索引与引用。"],
    ],
  },
  {
    id: "rag-index",
    title: "3. 向量化与 Qdrant",
    summary: "默认零运维本地模式，生产可切换 Qdrant Server。",
    items: [
      ["Embedding", "FastEmbed / ONNX multilingual MiniLM，384 维真实向量。"],
      ["本地", "Qdrant Local Mode 将索引持久化到项目数据目录，面试电脑无需 Docker。"],
      ["生产", "配置 QDRANT_URL 后连接独立 Qdrant Server。"],
      ["去重", "文件 SHA-256、模型名、维度和分块序号共同形成可追踪版本。"],
    ],
  },
  {
    id: "rag-search",
    title: "4. 混合召回、排序与审计",
    summary: "关键词与语义召回互补，未配置能力不会伪装成已启用。",
    items: [
      ["范围", "检索严格限定当前 taskId 绑定的 fileIds。"],
      ["召回", "BM25 与 cosine 分别召回，再用 Reciprocal Rank Fusion 合并。"],
      ["精排", "配置 BIOFLOW_RERANK_MODEL 后启用 cross-encoder；否则明确显示 RRF。"],
      ["输出", "Trace 返回片段、文件、分数、方式、参数绑定和最终工具选择。"],
    ],
  },
];

const dataSections: AtomicSection[] = [
  {
    id: "data-local",
    title: "1. 当前本机数据层",
    summary: "零 Docker、单命令启动的混合持久化，不是纯内存 Demo。",
    items: [
      ["state.json", "任务、对话、笔记、画布布局、运行事件和 RAG Trace。"],
      ["catalog-state.json", "技能启用状态与管理员创建的声明式技能。"],
      ["auth-users / projects", "用户 scrypt 哈希、角色权限和项目目录。"],
      ["research.sqlite", "文档解析与 PyDESeq2 作业记录，使用 SQLite WAL。"],
    ],
  },
  {
    id: "data-binary",
    title: "2. 向量、原件与产物",
    summary: "结构化元数据、向量索引和二进制对象分开保存。",
    items: [
      ["Qdrant Local", "保存 384 维 FastEmbed 向量、片段和定位 Metadata。"],
      ["objects/", "保存用户上传原件；预览和下载均经过 Bearer 鉴权。"],
      ["jobs/", "保存 PyDESeq2 日志、结果 CSV、火山图、报告和分析脚本。"],
      ["删除", "用户文件删除会同步清理 SQLite、Qdrant、原件和任务绑定。"],
    ],
  },
  {
    id: "data-production",
    title: "3. 生产目标模型",
    summary: "PostgreSQL 负责事务数据，对象存储和 Qdrant Server 各自承担明确职责。",
    items: [
      ["身份", "users、roles、permissions、sessions 与项目成员关系。"],
      ["任务", "projects、tasks、workflow_nodes/edges/layouts、runs 与 run_events。"],
      ["科研", "documents、document_chunks、rag_traces、analysis_jobs 与 artifacts。"],
      ["交付", "可下载的 SQL 包含约束、索引、触发器、角色和权限种子。"],
    ],
  },
  {
    id: "data-boundary",
    title: "4. 为什么不直接要求 Docker",
    summary: "面试现场先保证可运行，再展示清晰的生产迁移边界。",
    items: [
      [
        "操作成本",
        "本地只需 Node、Python 和 npm run dev，不要求安装 PostgreSQL、Redis 或 Docker Desktop。",
      ],
      ["数据真实性", "简化的是运维拓扑，不是文件解析、向量、SSE 或 PyDESeq2 计算。"],
      ["生产迁移", "DTO、API 和实体关系已经固定，可逐层替换存储而不重写前端业务组件。"],
      ["诚实说明", "本地方案不具备生产多租户、HA、强审计、配额和隔离能力。"],
    ],
  },
];

function AtomicAccordion({
  section,
  defaultExpanded = false,
}: {
  section: AtomicSection;
  defaultExpanded?: boolean;
}) {
  return (
    <Accordion className="documentation-accordion" disableGutters defaultExpanded={defaultExpanded}>
      <AccordionSummary expandIcon={<ExpandMoreRounded sx={{ fontSize: 18 }} />}>
        <span>
          <b>{section.title}</b>
          <small>{section.summary}</small>
        </span>
      </AccordionSummary>
      <AccordionDetails>
        {section.items.map(([label, detail]) => (
          <article key={`${section.id}-${label}`}>
            <b>{label}</b>
            <p>{detail}</p>
          </article>
        ))}
      </AccordionDetails>
    </Accordion>
  );
}

export function DocumentationDrawer({ open, onClose, activeTaskId }: DocumentationDrawerProps) {
  const [activeTab, setActiveTab] = useState<DocumentationTab>("guide");
  if (!open) return null;

  const renderSections = (sections: AtomicSection[]) => (
    <div className="documentation-accordion-list">
      {sections.map((section, index) => (
        <AtomicAccordion key={section.id} section={section} defaultExpanded={index === 0} />
      ))}
    </div>
  );

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
            <small>BIOFLOW STUDIO / DELIVERY HANDBOOK</small>
            <h2>开发与验收手册</h2>
            <p>当前任务：{activeTaskId}</p>
          </div>
          <IconButton onClick={onClose} aria-label="关闭文档中心">
            <CloseRounded sx={{ fontSize: 19 }} />
          </IconButton>
        </header>
        <nav className="documentation-tabs" aria-label="文档分类">
          {(
            [
              ["guide", "操作指引"],
              ["architecture", "系统架构"],
              ["api", "API"],
              ["frontend", "前端接入"],
              ["rag", "RAG 链路"],
              ["data", "数据与 DDL"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={activeTab === key ? "active" : ""}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="documentation-content">
          <div className="documentation-callout documentation-proof">
            <div>
              <b>不是纯前端 Demo</b>
              <span>受保护 API、真实 SSE、文档解析与 Qdrant、PyDESeq2 Worker 均已接入。</span>
            </div>
            <div className="documentation-proof-chips">
              <Chip size="small" label="Bearer Auth" />
              <Chip size="small" label="SSE" />
              <Chip size="small" label="Qdrant" />
              <Chip size="small" label="PyDESeq2" />
            </div>
          </div>

          {activeTab === "guide" && (
            <>
              <div className="documentation-section-head">
                <small>ONBOARDING / 7 ATOMIC CHECKS</small>
                <h3>从登录到结果交付</h3>
              </div>
              <div className="documentation-accordion-list guide-accordion-list">
                {guideSteps.map((step, index) => (
                  <AtomicAccordion
                    key={step.index}
                    defaultExpanded={index === 0}
                    section={{
                      id: `guide-${step.index}`,
                      title: `${step.index} · ${step.title}`,
                      summary: step.detail,
                      items: [
                        ["预期结果", step.expected],
                        ["失败排查", step.failure],
                      ],
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {activeTab === "architecture" && (
            <>
              <div className="documentation-section-head">
                <small>ARCHITECTURE / MODULE BOUNDARIES</small>
                <h3>八个可独立验收的模块</h3>
              </div>
              {renderSections(architectureSections)}
            </>
          )}

          {activeTab === "api" && (
            <>
              <div className="documentation-section-head documentation-section-actions">
                <div>
                  <small>HTTP API / AUTHENTICATED CONTRACTS</small>
                  <h3>按业务域查看接口</h3>
                </div>
                <div className="documentation-download-actions">
                  <Button
                    size="small"
                    startIcon={<DownloadRounded />}
                    onClick={() =>
                      void downloadAuthorizedFile(
                        "/api/docs/api-contract?download=1",
                        "BioFlow-Studio-API接口规范.md",
                      )
                    }
                  >
                    API 规范
                  </Button>
                  <Button
                    size="small"
                    startIcon={<DownloadRounded />}
                    onClick={() =>
                      void downloadAuthorizedFile(
                        "/api/docs/database-ddl?download=1",
                        "BioFlow-Studio-数据库设计.sql",
                      )
                    }
                  >
                    数据库 DDL
                  </Button>
                  <Button
                    size="small"
                    startIcon={<DownloadRounded />}
                    onClick={() =>
                      void downloadAuthorizedFile(
                        "/api/research/openapi",
                        "bioflow-research-openapi.json",
                      )
                    }
                  >
                    Worker OpenAPI
                  </Button>
                </div>
              </div>
              {renderSections(apiGroups)}
            </>
          )}

          {activeTab === "frontend" && (
            <>
              <div className="documentation-section-head">
                <small>FRONTEND / INTEGRATION CONTRACT</small>
                <h3>页面、状态与组件接入</h3>
              </div>
              {renderSections(frontendSections)}
              <div className="documentation-note">
                <b>当前任务上下文</b>
                <code>{activeTaskId}</code>
              </div>
            </>
          )}

          {activeTab === "rag" && (
            <>
              <div className="documentation-section-head">
                <small>RAG / INGESTION AND RETRIEVAL</small>
                <h3>从原文件到可审计证据</h3>
              </div>
              {renderSections(ragSections)}
              <div className="documentation-note">
                <b>生产扩展边界</b>
                <p>
                  Cross-encoder、视觉 OCR、知识图谱和完整 Mol* 均通过 Adapter
                  接入；未配置时界面会明确显示降级状态，不包装成生产级真实能力。
                </p>
              </div>
            </>
          )}

          {activeTab === "data" && (
            <>
              <div className="documentation-section-head documentation-section-actions">
                <div>
                  <small>DATA / LOCAL RUNTIME AND PRODUCTION TARGET</small>
                  <h3>当前数据层与生产迁移</h3>
                </div>
                <Button
                  size="small"
                  startIcon={<DownloadRounded />}
                  onClick={() =>
                    void downloadAuthorizedFile(
                      "/api/docs/database-ddl?download=1",
                      "BioFlow-Studio-数据库设计.sql",
                    )
                  }
                >
                  下载 PostgreSQL DDL
                </Button>
              </div>
              {renderSections(dataSections)}
              <div className="documentation-note">
                <b>面试时如何表述</b>
                <p>
                  当前是为了零 Docker 交付采用的真实本机混合持久化；生产目标已经用规范化 SQL
                  建模，但不能把本地 JSON/SQLite 描述成生产多租户数据库。
                </p>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
