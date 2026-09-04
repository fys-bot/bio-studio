# 变更记录

本文件记录 BioFlow Studio 每次可交付改动，提交代码时同步更新。

## 2026-09-04（第二轮）

### 运行闭环与鉴权增强

#### 产品与交互

- 将任务节点状态从前端临时状态迁移为服务端运行状态。
- 增加真实的运行器状态推进：启动、节点运行、失败、局部重试、完成和取消。
- 增加 Evidence Pipeline、运行日志、结果 Artifact 和 SSE 事件的统一关联。
- 增加 Results Inspector：火山图指标、产物列表和结果血缘回溯。
- 增加取消运行入口，明确取消是异步请求并保持状态反馈。

#### 技术实现

- 新增 `lib/store.ts`，集中管理 Demo 任务快照、事件游标、节点运行和 Artifact 状态。
- 新增 `/api/runs/[runId]/events` SSE 事件接口，支持 `after` 游标增量读取。
- 新增 `/api/runs/[runId]/cancel` 取消接口。
- 新增 `/api/runs/[runId]/nodes/[nodeId]/retry` 节点局部重试接口。
- 前端通过 EventSource 监听运行事件，并在事件到达后重新同步服务端任务快照。
- 会话 Cookie 改为带过期时间的 HMAC 签名 Token，并设置 HttpOnly、SameSite=Strict。
- 所有写操作 API 增加同源 Origin 校验。
- 增加 `results` Artifact viewer 和内嵌 SVG 火山图 Demo。

#### 验证

- `npm run typecheck` 通过。
- `npm run build` 通过。

## 2026-09-05（界面统一）

- 将智能体澄清卡片从深色开发控制台样式调整为暖灰纸张主题，统一边框、按钮、表单和提示层级。
- 将澄清阶段的标题、说明、字段、选项和 CTA 改为中文，强化“分析上下文确认”的产品语义。
- 将右侧 Inspector 与顶部操作栏的常用英文标签替换为中文，降低生命科学研究工作台的认知割裂。

### 修复：清理 Next.js 构建缓存导致的模块缺失

- 将旧 `.next` 缓存移动到系统临时目录并重新执行生产构建，修复 `Cannot find module './682.js'` 这类热更新残留问题。
- 统一 Evidence Pipeline 默认阶段名称为中文：识别研究意图、重写分析问题、检索与证据重排、绑定分析依据。
- 当前沙箱禁止监听本地 3000 端口，已确认属于环境权限限制；生产构建本身正常通过。
- README 增加旧端口进程与 404 的排查命令，优先使用生产预览减少热更新缓存问题。
- `package.json` 增加 `npm run preview`，一条命令完成构建并启动生产预览，规避开发热更新监听器导致的 404/EMFILE。
- 将计划审批卡片与中央工作流标题进一步中文化，统一面试演示中的研究流程表达。

## 2026-09-05（第七轮）

### 服务端代码流式事件

#### 产品与交互

- 将 Code Inspector 的代码生成过程纳入 Agent 运行事件链，代码不再只依赖前端本地模拟。
- 节点重试时先清空旧代码，再按服务端事件增量渲染新的分析脚本。
- 代码 Artifact 会和 DESeq2 节点、运行日志、结果产物保持同一条血缘链。

#### 技术实现

- `lib/store.ts` 新增 `emitCode`，通过 `code.delta` 事件逐字符发布分析脚本。
- 前端 SSE `onmessage` 处理 `code.delta`，增量更新 `codeText`。
- 重试接口增加 `artifact_code` 产物记录。
- 保留前端首轮 Demo 代码输出作为无事件时的可用降级展示。

## 2026-09-05（第八轮）

### RAG Evidence Pipeline 服务端事件化

#### 产品与交互

- Agent 运行时新增意图识别、检索启动、检索命中、证据重排和 grounding 事件。
- Evidence Pipeline 根据 SSE 实时事件更新阶段状态，不再只依赖静态种子数据。
- 检索阶段展示项目文件、Skills 和文献命中数量。
- Grounding 阶段展示已绑定的统计参数，强化“证据影响计划”的可解释性。
- Code Inspector 与 Evidence Pipeline 现在共享同一条服务端事件流。

#### 技术实现

- `lib/store.ts` 在工作流启动时发布 `intent.detected`、`retrieval.started`、`retrieval.hit`、`evidence.reranked` 和 `grounding.bound`。
- 前端 EventSource 增加事件类型映射，根据服务端 payload 更新 Evidence 卡片。
- 保持统一事件游标和任务快照同步机制。

#### 验证

- `npm run typecheck` 通过。
- `npm run build` 通过。

#### 验证

- `npm run typecheck` 通过。
- `npm run build` 通过。

#### 已知限制

- 当前 Store 为单进程 Demo 持久层，生产环境需替换为 SQLite/Postgres。
- SSE 运行器为确定性 Mock，不执行真实 RNA-seq 计算。

## 2026-09-04（第三轮）

### 持久化与计划审批接口

#### 产品与交互

- 为任务状态增加 clarification 数据，保留格式、比较组、物种和交付物选择。
- 增加从澄清答案生成计划的服务端接口，为后续“等待审批”页面接入做好准备。
- 增加独立的工作流计划审批接口，避免把计划批准和运行启动混为一步。
- 运行失败、局部重试、取消和结果完成状态均写入统一 Store。

#### 技术实现

- `lib/store.ts` 增加本地 `data/state.json` 文件持久化；在只读部署环境自动降级到进程内存。
- 增加 `/api/tasks/:taskId/clarifications`，校验澄清项完整性并生成计划事件。
- 增加 `/api/workflows/:workflowId/approve`，写入计划审批事件。
- 节点、运行、Artifact 和事件变更统一触发持久化。
- 新增 `data/state.json` 到忽略列表，避免把本地运行数据提交进仓库。

#### 验证

- `npm run typecheck` 通过。
- `npm run build` 通过，新增接口均被 Next.js 正确识别。

#### 已知限制

- 文件持久化适合单机面试 Demo，多进程生产环境需替换 SQLite/Postgres 和队列。
- 澄清与审批接口已完成，前端审批卡片将在下一轮接入主流程。

## 2026-09-04（第四轮）

### 接入前端澄清、计划审批与流式代码

#### 产品与交互

- 前端新增四项结构化澄清：数据格式、比较组、物种和交付物。
- 澄清未完成时，工作流保持门控状态，不能直接运行。
- 澄清提交后显示 6 步计划预览、预计耗时、证据数量和外部数据传输提示。
- 计划审批与工作流运行拆成两个用户动作，体现 Human-in-the-loop。
- Inspector 日志改为实时消费 SSE 事件并保留最近 100 条。
- Code Inspector 增加逐字符增量输出，模拟 Agent 代码生成过程。

#### 技术实现

- 前端接入 `/api/tasks/:taskId/clarifications` 和 `/api/workflows/:workflowId/approve`。
- 默认任务状态改为 `clarifying`，由澄清提交推动到 `awaiting_approval`。
- 计划批准后进入 `queued`，运行按钮在门控状态下自动禁用。
- 新增 `codeText` 增量状态，执行时逐步渲染分析代码。
- SSE `onmessage` 同步服务端任务快照并追加事件日志。

#### 验证

- `npm run typecheck` 通过。
- `npm run build` 通过。

#### 已知限制

- 代码流当前是前端增量演示，下一步可改为服务端 `code.delta` SSE 事件。
- 3D Viewer 当前仍为轻量降级预览，真实 Mol* 集成待后续版本。

## 2026-09-04（第五轮）

### Biomni 风格生命科学视觉重构

#### 产品与交互

- 根据竞品页面复盘，将产品从通用深色开发控制台调整为生命科学研究工作台。
- 保留 Agent Evidence Pipeline、工作流画布和动态 Inspector，但降低画布对主界面的压迫感。
- 强化 RNA-seq 领域语义：数据读取、样本质控、设计矩阵、DESeq2、显著基因、火山图和科研报告。
- 任务侧栏、数据集、状态文案和研究目标统一使用中文科研语境。
- 视觉基调改为暖灰纸张、石墨文字、荧光黄绿状态色，接近 Biomni 的实验室/研究产品气质。
- 节点状态同时使用图标、文字、边框和颜色，提升可扫描性与可访问性。

#### 技术实现

- 更新 `lib/store.ts` 默认 RNA-seq 节点名称、状态说明和任务目标。
- 更新 `app/page.tsx` 侧栏、任务头部、状态标签和主流程文案。
- 在 `app/globals.css` 增加 Biomni-inspired visual theme override，覆盖桌面、平板和移动端控件样式。
- 保留现有鉴权、SSE、持久化、澄清、审批、重试、取消和 Artifact 逻辑。

#### 验证

- `npm run typecheck` 通过。
- `npm run build` 通过。

#### 设计复盘

- 不再追求一比一复刻 Biomni 布局；改为借鉴其研究工作台气质，并把 Agent 证据链和结果血缘作为差异化能力。

## 2026-09-05（第六轮）

### 工作台可调布局交互

#### 产品与交互

- 左侧任务/数据栏支持横向拖拽调整宽度，范围 210–390px。
- 右侧 Evidence/Logs/Code/Results 检查器支持横向拖拽调整宽度，范围 260–520px。
- 上方 Evidence Pipeline 支持纵向拖拽调整高度，范围 70–220px。
- 拖拽过程中显示边界高亮，避免用户不知道当前可操作区域。
- 统一处理 `pointerdown / pointermove / pointerup`，支持触控板、鼠标和触摸输入。
- 拖拽时禁用文本选择，避免误选页面内容；移动端继续使用 Inspector 抽屉，不强制显示桌面分隔线。

#### 技术实现

- `app/page.tsx` 新增 `sidebarWidth`、`inspectorWidth`、`evidenceHeight` 和 `resizing` UI 状态。
- 使用 CSS Grid 内联变量实时更新三栏宽度。
- 新增左侧、右侧和水平 splitter 元素与统一 `startResize` 处理器。
- 增加最小/最大尺寸约束和 `touch-action: none`。

#### 验证

- `npm run typecheck` 通过。
- `npm run build` 通过。

## 2026-09-05（白屏问题修复）

### 本地启动与演示状态修复

#### 问题原因

- 排查确认白屏不是 React 渲染异常，而是 Chrome 打开的 `localhost:3000` 没有对应的 Next 开发进程。
- 本地 `data/state.json` 还保留了上一次运行后的旧英文失败快照，会遮蔽新版中文初始状态。

#### 改动

- 删除本地临时运行快照，使 Store 回到新版中文澄清初始状态。
- Next 开发和生产脚本明确绑定 `127.0.0.1`，降低本机监听地址差异造成的访问问题。
- 增加 `README.md` 白屏排查说明和 `npm run dev:poll` 文件监听降级命令。

#### 验证

- 本地服务启动后 `GET /` 返回 `200 OK`。
- 页面可正常返回 BioFlow Studio HTML 和客户端脚本。

## 2026-09-04

### 初始版本：搭建可解释科研 Agent 工作台

#### 产品与交互

- 将 Biomni 逆向方案定位为“可解释、可干预、可恢复的科研 AI 工作台”。
- 搭建任务侧栏、工作流画布、Evidence Pipeline、动态 Inspector 四层交互结构。
- 增加 RNA-seq 差异表达 Demo 工作流，覆盖读取数据、质量检查、设计矩阵、DESeq2、火山图和报告节点。
- 增加节点成功、运行中、阻塞、失败等状态表达。
- 增加失败节点的原因解释、下游影响提示和局部重试交互。
- 增加 Evidence、Logs、Code、3D 四种 Inspector 视图。
- 增加代码执行状态、3D 结构预览降级方案和移动端 Inspector 抽屉。
- 增加桌面端、平板端和移动端响应式布局。

#### 技术实现

- 初始化 Next.js 14 + React 18 + TypeScript 项目。
- 增加服务端 Cookie 会话鉴权，保护任务和运行 API。
- 增加 `/api/auth/login`、`/api/auth/logout`、`/api/tasks`、`/api/runs`。
- 增加服务端 Mock 运行入口，为后续 SQLite、SSE 和真实 Agent Adapter 预留接口。
- 增加 `.env.example`，明确模型密钥只能放在服务端环境变量。
- 增加 README 启动说明和安全边界说明。

#### 验证

- `npm run typecheck` 通过。
- `npm run build` 通过。
- 已忽略本地依赖、构建缓存、临时目录和环境变量文件。

#### 已知限制

- 当前使用确定性 Mock 数据，尚未接入 SQLite、SSE 和真实 LLM。
- 3D 结构当前为轻量降级预览，后续接入 Mol* 或 3Dmol.js。
- 本地沙箱限制端口监听，浏览器级 localhost 预览需在开发机执行。

## 2026-09-05

### 交互：增强蛋白质结构 Artifact 预览

- 为 3D 结构面板增加拖拽旋转反馈，使用指针事件适配鼠标与触控板操作。
- 增加残基点击识别与高亮状态，为后续联动证据、知识图谱和代码上下文保留状态入口。
- 增加结构置信度（pLDDT）和“拖拽旋转”操作提示，强化生命科学场景语义。
- 保留轻量静态降级方案，后续可将同一交互容器替换为 Mol* / 3Dmol.js。

#### 验证

- `npm run typecheck` 通过。
- `npm run build` 通过。
