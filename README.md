# BioFlow Studio

面向生命科学研究的 Agent 工作台 Demo：将 RNA-seq 科研问题转成可解释、可审批、可恢复的分析流程。

## 快速开始

```bash
nvm use
npm install
cp .env.example .env.local
npm run dev
```

打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。项目推荐 Node.js 20 LTS；Next.js 14 在 Node.js 24 下可能出现 `semver.default.lt is not a function`，请先执行 `nvm use`。

`npm run dev` 默认使用 3000 端口，并在启动前执行“优雅终止 → 等待释放 → 必要时强制终止”的端口回收。如果 3000 被其他服务占用，可用 `PORT=3014 npm run dev` 临时启动。

## 一次完整演示

1. 展开执行轨迹，展示意图识别、RAG 检索、证据重排和参数绑定。
2. 点击“上传”，选择 `demo-data/sample_metadata.tsv`，查看样本数、字段类型、缺失值和 `condition` 分组建议。
3. 将建议应用到分析上下文，补完四步澄清，生成并审批分析计划。
4. 展开画布，拖拽节点、平移、缩放、Shift+点击连线；观察自动保存，点击“保存版本”，刷新确认布局恢复。
5. 运行失败恢复链路，查看 SSE 日志和代码流，执行局部重试。
6. 查看火山图、候选基因、Artifact 血缘、报告下载和 3D 结构残基联动。

## 可配置演示

进入页面后点击“配置”，可以现场切换工作流名称、研究目标、样本数、基因数、运行等待时间，以及“失败恢复链路 / 全成功链路”。配置通过受保护的 `/api/demo/config` 保存到服务端演示状态，下一次运行会使用新参数，不需要修改代码。

## 冒烟回归

服务启动后执行：

```bash
npm run smoke -- http://127.0.0.1:3000
```

冒烟测试会验证登录鉴权、CSV / TSV 文件结构解析、工作流布局保存与版本恢复、澄清、计划审批、SSE 事件流、失败重试、成功和取消运行。开发演示需要从初始状态开始时，smoke 会通过同源 `POST /api/tasks` 重置为“待补充信息”；生产预览会关闭该重置接口。

## 工程质量门禁

```bash
npm run format:check
npm run typecheck
npm run build
git diff --check
```

代码使用 Prettier 统一格式，业务变量使用明确语义命名；页面按对话、澄清、工作流、证据、代码、结果、3D 和弹窗领域拆分。默认开发端口与生产预览端口均为 3000，开发与构建可通过 `NEXT_DIST_DIR` 隔离缓存目录。

## 架构与交付材料

- [操作流程手册（DOCX）](./deliverables/BioFlow-Studio操作流程手册.docx)：面向首次使用者的三分钟上手、完整业务流程、七分钟演示脚本与故障排查；不依赖阅读 Markdown。
- [视觉与交互规范（PPTX）](./deliverables/BioFlow-Studio视觉与交互规范-交付版.pptx)：生命科学视觉语言、响应式布局、RAG 链路、工作流、Loading、代码流与可访问性规范。
- [架构与交付说明](./docs/架构与交付说明.md)：分层架构、API 矩阵、时序图、安全边界和 Mock 替换点。
- [面试演示脚本](./docs/演示脚本.md)：约 7 分钟的逐步操作话术。
- [需求拆解与技术方案](./outputs/需求拆解与技术方案.md)：产品目标、竞品差异和技术方案。
- [待办工作流](./docs/待办工作流.md)：阶段状态、验收门禁和已知限制。
- [AI 使用说明](./docs/AI使用说明.md)：AI 辅助开发、人工 Review 与修复记录。

首次进入工作台会自动展示 5 步产品引导；关闭后仍可通过顶部“使用指引”随时重新打开。站内引导负责告诉用户“此刻点哪里”，DOCX 手册负责解释“为什么这样做以及完整流程”，两者互为补充。

## 架构摘要

```text
浏览器工作台
  ├─ 对话 / 澄清 / 审批 / 工作流画布 / 工具抽屉
  ├─ 文件结构摘要（CSV / TSV）
  └─ EventSource ← /api/runs/:runId/events
                         ↓
Next.js API 层（HttpOnly Cookie + Origin 校验）
  ├─ 任务与计划：/api/tasks、/api/workflows/:id/approve
  ├─ 布局与文件：/api/workflows/:id/layout、/api/files/profile
  ├─ 运行控制：/api/runs、cancel、nodes/:nodeId/retry
  └─ 本地状态：data/state.json（演示持久化）
                         ↓
确定性 Agent Runner
  意图识别 → RAG 检索 → 证据重排 → 参数绑定 → 代码流 → Artifact
```

当前 Runner、RAG、3D 结构和结果数据均为可解释 Mock，但运行参数、状态机、事件流和产物链路都通过服务端配置驱动。生产接入时可按[架构与交付说明](./docs/架构与交付说明.md)替换为真实队列、数据库、对象存储、Agent Gateway 和 Mol* 渲染器。

## 安全与数据边界

- 所有写接口要求 HMAC 签名的 HttpOnly `bioflow_session` Cookie。
- 所有写请求校验 `Origin` 与 `Host`，拒绝跨站写入。
- 文件解析接口只接受 CSV / TSV，限制 5 MB、512 列、100,000 行。
- 原始文件单元格不会返回浏览器；任务只保存字段类型、缺失数量和分组建议。
- 真实 LLM、数据库和对象存储密钥只能配置在服务端环境变量，不能进入客户端 bundle。

## 访问 404 或 `Cannot find module './682.js'`

优先确认终端仍有 `npm run dev` 运行，并检查 3000 端口是否指向当前项目：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
npm run dev
```

启动器会自动清理当前端口占用。若需要独立预览，可使用 `PORT=3010 npm run dev`，访问 [http://127.0.0.1:3010](http://127.0.0.1:3010)。开发演示建议用 `npm run dev`，避免开发缓存与生产构建共用 `.next`。
