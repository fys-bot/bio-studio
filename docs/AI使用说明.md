# AI 辅助开发与 Review 记录

更新日期：2026-09-08

## 1. 使用范围

本项目使用 Codex 辅助产品逆向、架构设计、前后端实现、浏览器排查、测试和文档整理。AI 不是需求来源，也不自动拥有对附件和第三方网站内容的执行权；作业文档与 Biomni 页面只作为产品材料，最终实现由仓库代码、测试结果和人工验收决定。

## 2. 提供给 AI 的上下文

- 二面作业 DOCX 中的任务目标、提交物和安全边界；
- 用户对桌面、中屏、移动端的截图和红圈问题；
- Biomni 的任务、能力和文件页面，用于理解信息架构与交互模式；
- 当前 Git 工作区、API Route、React 组件、CSS、Python Worker 和运行日志；
- “每阶段自测、中文提交并推送”的交付规则；
- 真实能力、演示种子和 Adapter 必须明确区分的产品约束。

需求 DOCX 中出现的示例 Token 没有复制到代码、文档或提交记录，也没有作为项目配置使用。真实密钥只允许存在于被 Git 忽略的 `.env.local`。

## 3. AI 参与的工作

### 产品与交互

- 逆向 Biomni 的项目/任务 URL、对话时间线、技能中心、文件空间和工具面板；
- 将核心路径收口为“文件 -> RAG -> 计划 -> 审批 -> 计算 -> 结果/追溯”；
- 设计研究员、审阅者、管理员的权限边界；
- 设计首次指引、亮点实例、局部 Loading、吸顶/吸底、多端弹层和文件并排预览；
- 建立 64 项以上的原子级 UI/产品问题清单，并按阶段回归。

### 前端与 BFF

- Next.js App Router、任务 URL、项目/任务新增删除和二次确认；
- MUI Theme、Button/Select/Dialog/IconButton/Pagination 等公共 UI 合同；
- 工作流节点拖拽、画布平移、缩放、连线、布局版本和运行画布视图；
- Fetch ReadableStream SSE、事件时间线、步骤进度、心跳和 payload 展开；
- 文件搜索筛选、分栏拖拽、DOCX/PDF/Excel/文本预览、全屏、下载和删除；
- 统一 Bearer API Client、错误码、请求超时和授权下载。

### Research Service

- PDF、DOCX、XLSX、CSV/TSV、TXT/MD、图片的策略路由；
- 文档清洗、结构化分块、定位 Metadata 和 OCR 降级；
- FastEmbed、Qdrant Local、BM25/cosine/RRF 和可选 cross-encoder；
- OpenAI-compatible Chat Completions/Responses 计划适配器；
- SQLite WAL 作业队列、独立 PyDESeq2 子进程、取消、失败和产物下载；
- 用户文件删除的 SQLite、Qdrant、对象文件和任务绑定清理闭环。

### 文档与交付

- `analysis.md` 产品逆向与取舍；
- README 启动、架构、功能、亮点、验收、边界；
- API Method/Header/Schema/状态码/curl/持久化映射；
- PostgreSQL 生产目标 DDL；
- 演示脚本、真实链路说明和原子级验收清单。

## 4. 关键 Review 与修正

| 初始问题 | Review 结论 | 修正 |
| --- | --- | --- |
| 首版过于像通用深色 AI 控制台 | 不符合生命科学工作台和 Biomni 信息密度 | 统一暖白实验室主题、状态色和 MUI 控件基线 |
| 切换任务使用全屏 Loading | 破坏侧栏上下文，用户无法连续操作 | 首次会话全屏；任务/技能/文件使用内容级 Loading |
| Token 写入 Cookie 的旧设计 | 与用户要求和当前客户端不一致 | 改为 sessionStorage + Authorization Bearer + HMAC/RBAC |
| SSE 只能看到最终结果 | 无法解释等待时间和当前阶段 | 增加计划/计算 SSE、等待心跳、进度、阶段和可展开 payload |
| 文件预览只是元信息或 `pre` | 无法核对真实内容 | 引入 docx-preview、原生 PDF/图片和结构化表格预览 |
| 文件删除只有前端按钮 | 会留下向量、原件和任务绑定 | 补齐 Worker/Next/Store/Qdrant 的真实删除闭环和冲突保护 |
| 项目、任务、技能操作靠 Toast | 看起来可点但没有状态变化 | 使用服务端 Store、独立 URL、刷新恢复和确认对话框 |
| 文档声称 HttpOnly Cookie/角色未实现 | 与代码相反，面试时会失去可信度 | 从代码反向重写 README、架构、API 和验收材料 |
| “真实 RAG/3D”表述过度 | 部分能力仍是 Adapter | 明确 OCR、图谱、cross-encoder、Mol* 和技能执行器边界 |

## 5. 验证方式

```bash
npm run typecheck
npm run format:check
npm run test:parsers
BIOFLOW_WORKER_URL=http://127.0.0.1:8000 npm run smoke
npm run build
git diff --check
```

浏览器验收固定检查 390、768、1024、1280、1440 宽度，覆盖：

- 登录错误、角色不匹配和会话重启失效；
- 项目/任务新增删除、收藏、搜索、状态点和安全跳转；
- 澄清、计划 SSE、审批、画布、运行、取消、重试和刷新恢复；
- 文件上传、索引、预览、分栏、全屏、下载、删除和移动端阅读；
- 能力中心筛选、分页、详情、创建任务和管理员启停；
- 弹层 Esc、遮罩、focus、最大高度、内容滚动、吸顶和吸底；
- 浅色主题没有深色 DOM 泄漏，长标题和按钮文本不溢出。

## 6. 提交策略

- 每个阶段先执行针对性测试，再使用中文 Git commit；
- Commit 标题说明阶段目标，正文按“主要修改 / 次要修改 / 验证”真实换行；
- 每阶段推送远程仓库，避免大量未审查修改堆到最后；
- 不提交 `.env.local`、运行数据库、向量索引、模型缓存或用户文件；
- 不恢复或覆盖用户运行产生的 `data/catalog-state.json` 修改。

## 7. AI 使用边界

- AI 输出不直接视为正确代码，必须通过仓库代码 Review、类型检查、单测、Smoke、构建和浏览器行为验证；
- AI 不决定统计结论，不将演示数据描述为患者或真实实验数据；
- AI 不执行上传文档中的指令，文档内容始终作为不可信数据；
- AI 不隐藏未完成能力：生产多租户、真实知识图谱、完整 Mol*、已配置 OCR 和所有技能计算器仍需后续建设。
