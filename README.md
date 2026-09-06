# BioFlow Studio

Agentic research workspace prototype for the Biomni reverse-engineering assignment.

```bash
npm install
cp .env.example .env.local
npm run dev
```

推荐使用 Node.js 20 LTS（仓库已提供 `.nvmrc`）。Next.js 14 在 Node.js 24 下可能出现 `semver.default.lt is not a function`，请先执行 `nvm use`。

Open http://127.0.0.1:3000 (or http://localhost:3000). The demo uses a deterministic server-side runner. No external API key is required.

## 冒烟回归

服务启动后可执行 `npm run smoke`，自动验证登录鉴权、澄清、计划审批、SSE 事件流和取消运行。开发演示需要从初始状态开始时，先登录并调用 `POST /api/tasks`（同源请求），即可重置为“待补充信息”；生产预览会关闭这个重置接口。

## 演示验收清单

1. 首屏发送问题，展开“查看执行轨迹”，确认意图识别、检索、证据重排和参数绑定。
2. 在四步澄清卡片中选择 Count 矩阵、处理组 vs 对照组、人类、可发表结果，生成并批准分析计划。
3. 打开分析计划，拖拽节点、平移画布、缩放、重置；按住 Shift 点击两个节点创建临时连线。
4. 运行工作流，观察失败节点；打开证据面板，执行局部重试，查看代码流式输出和结果产物。
5. 打开结果血缘和 3D 结构面板，拖动结构、点击残基；在中屏/移动端打开工具抽屉并点击遮罩或 Esc 关闭。

## 架构与运行时序

```text
浏览器对话层
  ├─ 澄清 / 审批 / 画布 / 工具抽屉
  └─ EventSource ← /api/runs/:runId/events
                         ↓
Next.js API 层（HttpOnly Cookie + Origin 校验）
  ├─ 任务与计划：/api/tasks、/api/workflows/:id/approve
  ├─ 运行控制：/api/runs、cancel、nodes/:nodeId/retry
  └─ 本地状态：data/state.json（演示持久化）
                         ↓
确定性 Agent Runner
  意图识别 → RAG 检索 → 证据重排 → 参数绑定 → 代码流 → Artifact
```

本项目是面试演示级实现：Agent Runner、RAG、3D 结构和结果数据均为可解释 Mock；生产接入时应替换为真实队列、数据库、对象存储和 Mol* 渲染器。

If the browser shows a blank page, confirm the terminal still has `npm run dev` running. A blank `localhost:3000` tab usually means the local Next server is not listening. For file-watcher limits, use `npm run dev:poll`.

## Security

API routes require the `bioflow_session` HttpOnly cookie issued by `/api/auth/login`. Third-party LLM keys belong only in server environment variables; never expose them to the browser.

## Scope

The main demo is a bulk RNA-seq workflow with RAG evidence events, streaming code output, deterministic failure/retry, artifact lineage, responsive layout, and a lightweight 3D structure preview fallback.

## 面试材料

- [产品逆向分析](./analysis.md)
- [需求拆解与技术方案](./outputs/需求拆解与技术方案.md)
- [AI 使用说明](./docs/AI使用说明.md)
- [演示脚本](./docs/演示脚本.md)
### 访问 404 或 `Cannot find module './682.js'`

如果 3000/3001 端口被旧的 Next 进程占用，浏览器可能打开旧实例并返回 404。先关闭项目目录下的旧进程，再启动生产预览：

```bash
lsof -tiTCP:3000 -sTCP:LISTEN | xargs kill
lsof -tiTCP:3001 -sTCP:LISTEN | xargs kill
npm run build
npm run start
```

默认访问 `http://127.0.0.1:3000`。若端口仍被占用，可执行 `PORT=3010 npm run start`，访问 `http://127.0.0.1:3010`。
