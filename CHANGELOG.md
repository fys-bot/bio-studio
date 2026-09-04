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
