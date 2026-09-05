# BioFlow Studio

Agentic research workspace prototype for the Biomni reverse-engineering assignment.

```bash
npm install
cp .env.example .env.local
npm run dev
```

推荐使用 Node.js 20 LTS（仓库已提供 `.nvmrc`）。Next.js 14 在 Node.js 24 下可能出现 `semver.default.lt is not a function`，请先执行 `nvm use`。

Open http://127.0.0.1:3000 (or http://localhost:3000). The demo uses a deterministic server-side runner. No external API key is required.

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
