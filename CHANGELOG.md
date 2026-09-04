# 变更记录

本文件记录 BioFlow Studio 每次可交付改动，提交代码时同步更新。

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
