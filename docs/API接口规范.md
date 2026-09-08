# BioFlow Studio API 接口规范

更新日期：2026-09-08
适用版本：`bioflow-studio@0.1.0`
默认地址：`http://127.0.0.1:3000`

本文档以当前仓库代码为准，描述浏览器调用的 Next.js BFF 接口。Research Service 的 FastAPI OpenAPI 可在登录后通过 `GET /api/research/openapi` 下载。文档中的 Token、文件 ID、任务 ID 均为占位符，不包含真实密钥。

## 1. 全局协议

### 1.1 调用拓扑

```text
Browser
  -> Next.js BFF /api/*
     Authorization: Bearer <HMAC access token>
     Origin / Host write protection
  -> Research Service
     X-Bioflow-Worker-Token: <server-only token>
```

浏览器不直接访问 Python Worker、Qdrant、SQLite 或模型供应商。所有服务端密钥均留在服务端环境变量。

### 1.2 认证与会话

| 项目 | 规格 |
| --- | --- |
| Token 类型 | 自定义 `base64url(payload).HMAC-SHA256(signature)`，不是 JWT |
| 浏览器存储 | `sessionStorage.bioflow_access_token_v1` |
| 请求头 | `Authorization: Bearer <accessToken>` |
| 有效期 | 8 小时 |
| 重启策略 | Next.js 服务进程重启后 nonce 变化，旧 Token 立即失效 |
| 写请求保护 | 校验 `Origin.host === Host`；脚本无 Origin 时允许本机调用 |
| 退出 | 服务端确认当前 Token 有效，前端清除 `sessionStorage` |

生产环境建议将短期 Access Token 放在内存，并增加可撤销 Refresh Session；若改回 Cookie，应使用 `HttpOnly + Secure + SameSite` 并补 CSRF 防护。当前实现遵循本项目要求的 Bearer Header 方式。

### 1.3 权限码

| 权限 | 研究员 | 审阅者 | 管理员 | 用途 |
| --- | :---: | :---: | :---: | --- |
| `tasks:read` | 是 | 是 | 是 | 读取项目、任务、布局、文档中心 |
| `tasks:write` | 是 | 否 | 是 | 创建/删除任务和项目、澄清、审批、布局写入 |
| `files:read` | 是 | 是 | 是 | 文件目录、正文、原件 |
| `files:write` | 是 | 否 | 是 | 上传、重解析、删除文件 |
| `skills:read` | 是 | 是 | 是 | 能力中心 |
| `skills:write` | 否 | 否 | 是 | 创建技能、启停技能 |
| `runs:execute` | 是 | 否 | 是 | RAG、LLM 计划、Runner、PyDESeq2 |
| `reviews:write` | 是 | 是 | 是 | 研究笔记/审阅意见 |
| `users:manage` | 否 | 否 | 是 | 用户和权限管理、测试数据清理 |

### 1.4 通用 Header

```http
Accept: application/json
Authorization: Bearer <accessToken>
Content-Type: application/json
```

SSE 请求额外发送：

```http
Accept: text/event-stream
Cache-Control: no-cache
```

文件上传使用 `multipart/form-data`，不要手工设置 boundary。

### 1.5 通用错误

| HTTP | 语义 | 响应示例 |
| ---: | --- | --- |
| `400` | 参数、字段或状态不合法 | `{"error":"项目名称不能为空"}` |
| `401` | Token 缺失、签名错误、过期或服务已重启 | `{"error":"登录状态已失效，请重新登录"}` |
| `403` | 角色无权限或 Origin 不同源 | `{"error":"当前角色没有执行此操作的权限"}` |
| `404` | 资源不存在 | `{"error":"Task not found"}` |
| `409` | 资源受保护、状态冲突或正在使用 | `{"error":"文件正在被计算作业使用"}` |
| `422` | 文件解析、RAG 或计算输入无法处理 | `{"error":"解析失败原因"}` |
| `502` | 上游 LLM 协议或供应商错误 | SSE `plan.failed` 或 JSON 错误体 |
| `503` | Research Service 或交付文档不可用 | `{"error":"科研服务未连接..."}` |

统一错误 Schema：

| 字段 | JSON 类型 | 生产 SQL 类型 | 必填 | 说明 |
| --- | --- | --- | :---: | --- |
| `error` | `string` | `text` | 是 | 可直接展示的中文错误 |
| `code` | `string` | `varchar(80)` | 否 | 登录或计划生成的机器可读错误码 |
| `hint` | `string` | `text` | 否 | 可操作排查建议 |

### 1.6 SSE 事件格式

```text
id: 7
event: analysis.running
data: {"id":7,"runId":"...","type":"analysis.running","createdAt":"...","payload":{...}}

```

| 字段 | JSON 类型 | 生产 SQL 类型 | 约束 |
| --- | --- | --- | --- |
| `id` | `number` | `bigint` | 同一事件流单调递增 |
| `runId` | `string` | `uuid/varchar(100)` | 计划流使用 `planning:<taskId>` |
| `type` | `string` | `varchar(100)` | 事件类型 |
| `createdAt` | ISO 8601 `string` | `timestamptz` | 服务端时间 |
| `nodeId` | `string` | `uuid/varchar(80)` | 可选工作流节点 |
| `payload` | `object` | `jsonb` | 当前步骤、进度、等待原因和审计数据 |

## 2. 核心 DTO 与 SQL 映射

### 2.1 `SessionUser`

| 字段 | JSON 类型 | 生产 SQL | 约束 |
| --- | --- | --- | --- |
| `id` | `string` | `users.id uuid` | 稳定用户标识 |
| `username` | `string` | `users.username varchar(32)` | 唯一，小写账号 |
| `name` | `string` | `users.display_name varchar(80)` | 展示名 |
| `role` | `researcher/reviewer/admin` | `roles.code varchar(32)` | 单一主角色 |
| `permissions` | `string[]` | `role_permissions/user_permissions` | 最终有效权限集合 |

### 2.2 `WorkspaceProject`

| 字段 | JSON 类型 | 生产 SQL | 约束 |
| --- | --- | --- | --- |
| `id` | `string` | `projects.project_key varchar(40)` | 当前本地格式为 `proj_*` |
| `name` | `string` | `projects.name varchar(120)` | 当前接口限制 2–48 字符 |
| `description` | `string` | `projects.description text` | 项目说明 |
| `protected` | `boolean` | `projects.protected boolean` | 受保护项目不能删除 |
| `createdAt` | ISO `string` | `projects.created_at timestamptz` | 创建时间 |

### 2.3 `ResearchTask`

| 字段 | JSON 类型 | 生产 SQL | 约束 |
| --- | --- | --- | --- |
| `id` | `string` | `tasks.task_key varchar(80)` | 当前格式 `task_*` |
| `title` | `string` | `tasks.title varchar(240)` | 任务标题 |
| `goal` | `string` | `tasks.goal text` | 研究目标 |
| `status` | `string` | `tasks.status varchar(32)` | `draft/clarifying/awaiting_approval/queued/running/succeeded/failed/cancelled` |
| `progress` | `number` | `tasks.progress smallint` | `0..100` |
| `executionMode` | `real/demo` | `tasks.execution_mode varchar(12)` | 新任务默认 `real` |
| `skill` | `SkillRecord` | `task_skills` | 可选技能快照 |
| `fileIds` | `string[]` | `task_files` | 绑定文件 |
| `clarification` | `object` | `tasks.clarification jsonb` | 四项研究上下文 |
| `plan` | `object` | `tasks.plan jsonb` | LLM 计划、模型、模式与时间 |
| `nodes/edges` | `array` | `workflow_nodes/workflow_edges` | 画布状态 |
| `artifacts` | `array` | `artifacts` | 结果与血缘 |

### 2.4 `ResearchDocument`

| 字段 | JSON 类型 | 生产 SQL | 约束 |
| --- | --- | --- | --- |
| `id` | `string` | `documents.file_key varchar(80)` | 当前为 32 位内容标识 |
| `name` | `string` | `documents.original_name varchar(500)` | 安全文件名 |
| `format` | `string` | `documents.format varchar(20)` | CSV/TSV/TXT/MD/XLSX/PDF/DOCX/PNG/JPG |
| `sizeBytes` | `number` | `documents.size_bytes bigint` | `1..10MB` |
| `sha256` | `string` | `documents.sha256 char(64)` | 原件摘要 |
| `parser` | `string` | `documents.parser varchar(120)` | 实际解析器 |
| `indexStatus` | `string` | `documents.index_status varchar(24)` | pending/indexing/indexed/failed/needs_ocr/empty |
| `needsOcr` | `boolean` | `documents.needs_ocr boolean` | 是否需视觉 OCR |
| `sections` | `array` | 文档分段表/对象存储 | 最多返回 50 段，每段正文最多 10,000 字符 |
| `routes` | `array` | `jsonb` | PDF 页级解析策略 |

### 2.5 `AnalysisJob`

| 字段 | JSON 类型 | 生产 SQL | 约束 |
| --- | --- | --- | --- |
| `id` | `string` | `analysis_jobs.job_key varchar(100)` | UUID |
| `taskId` | `string` | `analysis_jobs.task_id uuid` | 任务隔离 |
| `status` | `string` | `analysis_jobs.status varchar(24)` | queued/running/succeeded/failed/cancelled |
| `createdAt` | Unix 秒 | `analysis_jobs.created_at timestamptz` | Worker 时间 |
| `error` | `string` | `analysis_jobs.error_message text` | 失败原因 |
| `result` | `object` | `analysis_jobs.result_summary jsonb` | 引擎、设计、样本数、候选基因和产物 |

## 3. 鉴权与用户

### 3.1 `POST /api/auth/login`

- 权限：公开；写请求同源校验。
- 请求：`{"username":"researcher","password":"bioflow2026","role":"researcher"}`。
- 响应：`{"authenticated":true,"accessToken":"<token>","expiresAt":178... ,"user":<SessionUser>}`。
- 状态码：`200` 成功；`400 INVALID_ROLE`；`401 WRONG_PASSWORD`；`403 ACCOUNT_DISABLED/ROLE_MISMATCH`；`404 ACCOUNT_NOT_FOUND`。
- 持久化：读取 `auth-users.json`；生产映射 `users/roles/user_permissions/access_sessions`。

```bash
curl -sS http://127.0.0.1:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  --data '{"username":"researcher","password":"bioflow2026","role":"researcher"}'
```

### 3.2 `GET /api/auth/session`

- 权限：有效 Bearer Token。
- 请求参数：无。
- 响应：与登录成功响应相同，并返回当前 Token。
- 状态码：`200/401`。
- 持久化：重新读取用户状态；用户被停用或角色变化后旧 Token 失效。

```bash
curl -sS http://127.0.0.1:3000/api/auth/session -H "Authorization: Bearer $TOKEN"
```

### 3.3 `POST /api/auth/logout`

- 权限：已登录；同源校验。
- 响应：`{"ok":true}`。
- 状态码：`200/401/403`。
- 持久化：当前本地版本不保存服务端 Session，前端负责清除 Token。

```bash
curl -sS -X POST http://127.0.0.1:3000/api/auth/logout -H "Authorization: Bearer $TOKEN"
```

### 3.4 `GET /api/admin/users`

- 权限：`users:manage`。
- 响应：`{"users":[ManagedUser...]}`，不返回密码哈希或盐。
- 状态码：`200/401/403`。
- 持久化：`auth-users.json`；生产映射 `users/roles/permissions`。

```bash
curl -sS http://127.0.0.1:3000/api/admin/users -H "Authorization: Bearer $TOKEN"
```

### 3.5 `POST /api/admin/users`

- 权限：`users:manage`；同源校验。
- 请求字段：`username:string`、`password:string(8..128)`、`name:string`、`role`、可选 `permissions:string[]`、`enabled:boolean`。
- 响应：`201 {"user":<ManagedUser>,"users":[...]}`。
- 状态码：`201/400/401/403`。
- 持久化：密码使用随机盐 + scrypt 哈希，原文不落盘。

```bash
curl -sS -X POST http://127.0.0.1:3000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"username":"reviewer2","password":"review2026","name":"项目审阅者","role":"reviewer"}'
```

### 3.6 `PATCH /api/admin/users`

- 权限：`users:manage`；同源校验。
- 请求字段：必填 `id`；可选 `name/role/permissions/enabled/password`。
- 响应：`{"user":<ManagedUser>,"users":[...]}`。
- 状态码：`200/400/401/403/409`；当前管理员不能停用自己或移除自己的管理员角色。
- 持久化：更新 `auth-users.json`；角色变化立即使旧角色 Token 失效。

```bash
curl -sS -X PATCH http://127.0.0.1:3000/api/admin/users \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"id":"user-id","enabled":false}'
```

## 4. 项目与任务

### 4.1 `GET /api/projects`

- 权限：`tasks:read`。
- 响应：`{"projects":[WorkspaceProject...]}`。
- 状态码：`200/401`。
- 持久化：`projects.json`；生产映射 `projects/project_members`。

```bash
curl -sS http://127.0.0.1:3000/api/projects -H "Authorization: Bearer $TOKEN"
```

### 4.2 `POST /api/projects`

- 权限：`tasks:write`；同源校验。
- 请求：`{"name":"免疫治疗队列"}`，规范化后 2–48 字符且不能重名。
- 响应：`201 {"project":<WorkspaceProject>,"projects":[...]}`。
- 状态码：`201/400/401/403`。
- 持久化：原子临时文件替换 `projects.json`。

```bash
curl -sS -X POST http://127.0.0.1:3000/api/projects \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"免疫治疗队列"}'
```

### 4.3 `DELETE /api/projects?id=:projectId`

- 权限：`tasks:write`；同源校验。
- Query：`id` 必填。
- 响应：`{"project":<deleted>,"projects":[remaining...]}`。
- 状态码：`200/400/401/403/409`；受保护演示项目不能删除。
- 当前边界：本地项目记录尚未拥有任务外键，因此只删除项目目录记录；生产 DDL 使用 `tasks.project_id ON DELETE CASCADE`。

```bash
curl -sS -X DELETE 'http://127.0.0.1:3000/api/projects?id=proj_xxx' \
  -H "Authorization: Bearer $TOKEN"
```

### 4.4 `GET /api/tasks`

- 权限：已登录。
- 响应：`{"task":<default snapshot>,"tasks":[TaskListItem...]}`。
- 状态码：`200/401`。
- 持久化：`data/state.json`。

```bash
curl -sS http://127.0.0.1:3000/api/tasks -H "Authorization: Bearer $TOKEN"
```

### 4.5 `POST /api/tasks`

- 权限：`tasks:write`；同源校验。
- 创建请求：`title:string`，可选 `skillId:string`、`fileIds:string[]`（最多 100 个 32 位 ID）、`executionMode:real|demo`。
- 创建响应：`{"task":<ResearchTask>,"tasks":[...]}`。
- 无 JSON title：仅开发环境重置演示任务；生产返回 `404`。
- 状态码：`200/400/401/403/404`。
- 持久化：任务快照写入 `data/state.json`；技能配置写入任务快照。

```bash
curl -sS -X POST http://127.0.0.1:3000/api/tasks \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"title":"真实 RNA-seq 分析","skillId":"rnaseq-deseq2","fileIds":[],"executionMode":"real"}'
```

### 4.6 `GET /api/tasks/:taskId`

- 权限：已登录。
- Path：`taskId`。
- 响应：`{"task":<ResearchTask>,"tasks":[TaskListItem...]}`。
- 状态码：`200/401/404`。

```bash
curl -sS http://127.0.0.1:3000/api/tasks/task_demo_rnaseq -H "Authorization: Bearer $TOKEN"
```

### 4.7 `DELETE /api/tasks/:taskId`

- 权限：`tasks:write`；同源校验。
- 响应：`{"deletedTaskId":"...","tasks":[remaining...]}`。
- 状态码：`200/401/403/404/409`；默认演示任务和运行中任务受保护。
- 持久化：清理任务、对话、笔记、布局、运行映射与关联状态。

```bash
curl -sS -X DELETE http://127.0.0.1:3000/api/tasks/task_xxx -H "Authorization: Bearer $TOKEN"
```

### 4.8 `POST /api/tasks/:taskId/clarifications`

- 权限：`tasks:write`；同源校验。
- 请求：`{"answers":{"format":"Count 矩阵","comparison":"处理组 vs 对照组","organism":"人类","deliverable":"可发表结果"}}`。
- 响应：`{"task":<ResearchTask>}`。
- 状态码：`200/400/401/403/404`；所有答案必须非空。
- 持久化：`tasks.clarification` 对应本地任务快照。

```bash
curl -sS -X POST http://127.0.0.1:3000/api/tasks/task_xxx/clarifications \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"answers":{"format":"Count 矩阵","comparison":"treated vs control","organism":"人类","deliverable":"报告与结果表"}}'
```

### 4.9 `POST /api/tasks/:taskId/approve`

- 权限：`tasks:write`；同源校验。
- 请求体：无。
- 响应：`{"task":<ResearchTask>}`。
- 状态码：`200/401/403/404`；真实任务缺少 LLM 计划时不能审批。
- 持久化：任务进入可运行状态。

```bash
curl -sS -X POST http://127.0.0.1:3000/api/tasks/task_xxx/approve -H "Authorization: Bearer $TOKEN"
```

### 4.10 `GET/PUT /api/tasks/:taskId/conversation`

- GET 权限：已登录；响应 `{"messages":[ConversationMessage...]}`。
- PUT 权限：`tasks:write`；同源校验。
- PUT 请求：`{"messages":[...]}`，最多 100 条。
- 状态码：`200/400/401/403/404`。
- 持久化：`data/state.json.conversations[taskId]`；生产映射 `conversation_messages`。

```bash
curl -sS http://127.0.0.1:3000/api/tasks/task_xxx/conversation -H "Authorization: Bearer $TOKEN"
curl -sS -X PUT http://127.0.0.1:3000/api/tasks/task_xxx/conversation \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"messages":[]}'
```

### 4.11 `GET/PUT /api/tasks/:taskId/notes`

- GET 权限：已登录；响应 `{"notes":"..."}`。
- PUT 权限：`reviews:write`；同源校验；请求 `{"notes":"审阅意见"}`。
- 状态码：`200/400/401/403/404`。
- 持久化：`data/state.json.notesByTaskId`；生产可映射 `tasks.notes` 或独立 review 表。

```bash
curl -sS http://127.0.0.1:3000/api/tasks/task_xxx/notes -H "Authorization: Bearer $TOKEN"
curl -sS -X PUT http://127.0.0.1:3000/api/tasks/task_xxx/notes \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"notes":"已核对分组与批次设计。"}'
```

## 5. 文件与解析

### 5.1 `GET /api/files`

- 权限：已登录。
- 响应：`CatalogPage<ProjectFileRecord>`，字段为 `items/total/page/pageSize/source/updatedAt`。
- 状态码：`200/401/503`。
- 持久化：Worker SQLite `records(kind='document')`；文件原件在 `objects/`。

```bash
curl -sS http://127.0.0.1:3000/api/files -H "Authorization: Bearer $TOKEN"
```

### 5.2 `POST /api/files/profile?taskId=:taskId`

- 权限：`files:write`；同源校验。
- 请求：`multipart/form-data`，字段 `file`。
- 类型：CSV、TSV、TXT、MD、XLSX、PDF、DOCX、PNG、JPG/JPEG。
- 限制：1 字节至 10MB；任务必须存在。
- 响应：`{"profile":<DataFileProfile>,"document":<ResearchDocument>,"task":<ResearchTask>}`。
- 状态码：`200/400/401/403/404/422`。
- 持久化：原文件、SQLite 文档记录、后台 Qdrant 索引、任务文件绑定。

```bash
curl -sS -X POST 'http://127.0.0.1:3000/api/files/profile?taskId=task_xxx' \
  -H "Authorization: Bearer $TOKEN" -F 'file=@./sample_metadata.tsv'
```

### 5.3 `GET /api/files/:fileId`

- 权限：已登录。
- 响应：`ResearchDocument`；最多 50 个 section，正文按段截断到 10,000 字符。
- 状态码：`200/401/404/503`。
- 持久化：读取 SQLite 文档 JSON；不直接暴露服务端对象路径或内部 chunks。

```bash
curl -sS http://127.0.0.1:3000/api/files/FILE_ID -H "Authorization: Bearer $TOKEN"
```

### 5.4 `DELETE /api/files/:fileId`

- 权限：`files:write`；同源校验。
- 响应：`{"deletedFileId":"...","deletedName":"...","affectedTaskIds":[...]}`。
- 状态码：`200/401/403/404/409/503`。
- 冲突：示例文件受保护；queued/running 作业使用中的文件不能删除；对象路径必须位于受管理目录。
- 持久化：删除 SQLite 记录、Qdrant points、本地原件，并清理任务 `fileIds/dataProfiles` 与旧索引。

```bash
curl -sS -X DELETE http://127.0.0.1:3000/api/files/FILE_ID -H "Authorization: Bearer $TOKEN"
```

### 5.5 `GET /api/files/:fileId/original?download=1`

- 权限：已登录。
- Query：存在 `download` 时使用 attachment，否则 inline。
- 响应：原始二进制流，带正确 `Content-Type`、UTF-8 文件名、`nosniff/no-store`。
- 状态码：`200/401/503`。
- 持久化：读取 `objects/<content-id>.<ext>`。

```bash
curl -sS http://127.0.0.1:3000/api/files/FILE_ID/original \
  -H "Authorization: Bearer $TOKEN" -o original.bin
```

### 5.6 `POST /api/files/:fileId/reparse`

- 权限：`files:write`；同源校验。
- 响应：`{"file":<ProjectFileRecord>}`。
- 状态码：`200/401/403/404/503`。
- 持久化：重新解析原件，状态置为 pending，并异步重建 Qdrant 索引。

```bash
curl -sS -X POST http://127.0.0.1:3000/api/files/FILE_ID/reparse -H "Authorization: Bearer $TOKEN"
```

## 6. RAG

### 6.1 `GET /api/rag/query`

- 权限：已登录。
- 响应：`{"traces":[RagTrace...]}`。
- 状态码：`200/401`。
- 持久化：`data/state.json.ragTraces`；生产映射 `rag_traces/rag_trace_items`。

```bash
curl -sS http://127.0.0.1:3000/api/rag/query -H "Authorization: Bearer $TOKEN"
```

### 6.2 `POST /api/rag/query?taskId=:taskId`

- 权限：`runs:execute`；同源校验。
- 请求：`{"query":"问题，1..2000 字符","mode":"快速模式|标准模式|深度研究","includeAnswer":true|false}`。
- 响应：始终返回 `{"trace":<RagTrace>}`；当 `includeAnswer=true` 时，额外返回 `answer.content/provider/model`，由服务端使用同一份 LLM 环境变量生成自然语言分析答复。
- 状态码：`200/400/401/403/404/409/422/502`。
- 行为：有 `fileIds` 时真实调用 Qdrant + BM25 + RRF；真实任务无文件返回 `409`；对话请求只把前 3 条可审计片段传给模型，模型不可见 Token、Worker Token、对象路径或完整本地数据。
- 持久化：保存完整 Trace、来源、分数、模式和 reasoning effort；模型密钥不进入 Trace 或浏览器。

```bash
curl -sS -X POST 'http://127.0.0.1:3000/api/rag/query?taskId=task_xxx' \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"query":"实验方案中推荐的 FDR 阈值是什么？","mode":"标准模式","includeAnswer":true}'
```

### 6.3 `GET /api/rag/traces/:traceId`

- 权限：已登录。
- 响应：`{"trace":<RagTrace>}`。
- 状态码：`200/401/404`。
- 持久化：读取任务级 Trace。

```bash
curl -sS http://127.0.0.1:3000/api/rag/traces/TRACE_ID -H "Authorization: Bearer $TOKEN"
```

### 6.4 `GET /api/rag/traces/:traceId/:stage`

- 权限：已登录。
- Stage：`documents/chunks/retrieval/rerank/graph/grounding/tools`。
- 响应：`{"traceId":"...","stage":"retrieval","data":[...]}`。
- 状态码：`200/401/404`。

```bash
curl -sS http://127.0.0.1:3000/api/rag/traces/TRACE_ID/retrieval -H "Authorization: Bearer $TOKEN"
```

### 6.5 `GET /api/rag/traces/:traceId/events`

- 权限：已登录。
- 响应：一次性 SSE，先发送完整 `trace`，再发送 `completed` 并关闭。
- 状态码：`200/401/404`。
- 边界：这是已完成 Trace 的流式读取，不是实时检索过程；实时计划与计算分别使用后续 SSE 接口。

```bash
curl -N http://127.0.0.1:3000/api/rag/traces/TRACE_ID/events \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: text/event-stream'
```

## 7. Agent 计划与 SSE

### 7.1 `POST /api/agent/plan`

- 权限：`runs:execute`；同源校验。
- 请求字段：`taskId:string`、`query:string`、`clarification:object`、`evidence:array`、`mode`。
- JSON 模式：`Accept: application/json`，响应 `{"plan":...,"task":...}`。
- SSE 模式：`Accept: text/event-stream`，推送校验、Worker、直连回退、等待心跳、持久化、完成/失败。
- 事件：`plan.started`、`worker.started/completed/failed`、`llm.started/completed`、`plan.waiting`、`plan.persisting`、`plan.completed/failed`。
- 状态码：建立 SSE 前可能为 `400/401/403/404`；流建立后的上游失败通过 `plan.failed` 事件返回；JSON 模式使用 `500/502`。
- 持久化：成功计划写入当前任务；模型 Key 只由 Worker/Next 服务端读取。

```bash
curl -N -X POST http://127.0.0.1:3000/api/agent/plan \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: text/event-stream' \
  -H 'Content-Type: application/json' \
  --data '{"taskId":"task_xxx","query":"比较处理组与对照组","clarification":{"format":"Count 矩阵"},"evidence":[],"mode":"标准模式"}'
```

## 8. 运行与真实计算

### 8.1 `POST /api/runs?taskId=:taskId`

- 权限：`runs:execute`；同源校验。
- 用途：启动稳定演示 Runner；真实任务应使用 PyDESeq2 面板。
- 响应：`{"runId":"...","task":<ResearchTask>}`。
- 状态码：`200/401/403/404/409`。
- 持久化：运行、节点状态与事件写入 `data/state.json`。

```bash
curl -sS -X POST 'http://127.0.0.1:3000/api/runs?taskId=task_demo_rnaseq' \
  -H "Authorization: Bearer $TOKEN"
```

### 8.2 `GET /api/runs/:runId/events?after=:eventId`

- 权限：已登录。
- 恢复：优先 Query `after`，其次 `Last-Event-ID`。
- 响应：持续 SSE，每 250ms 检查新事件，客户端断开时关闭。
- 状态码：`200/401`。
- 持久化：`events` 按 `runId + id` 读取；生产映射 `run_events(run_id,sequence_no)`。

```bash
curl -N 'http://127.0.0.1:3000/api/runs/RUN_ID/events?after=0' \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: text/event-stream'
```

### 8.3 `POST /api/runs/:runId/cancel`

- 权限：`runs:execute`；同源校验。
- 响应：`{"ok":true}` 或当前运行状态。
- 状态码：`200/401/403`。
- 持久化：标记运行取消并追加事件。

```bash
curl -sS -X POST http://127.0.0.1:3000/api/runs/RUN_ID/cancel -H "Authorization: Bearer $TOKEN"
```

### 8.4 `POST /api/runs/:runId/nodes/:nodeId/retry`

- 权限：`runs:execute`；同源校验。
- 响应：`{"task":<ResearchTask>}` 或状态结果。
- 状态码：`200/401/403`；非法节点通过业务响应说明。
- 持久化：失败节点及下游状态恢复，并追加重试事件。

```bash
curl -sS -X POST http://127.0.0.1:3000/api/runs/RUN_ID/nodes/design/retry \
  -H "Authorization: Bearer $TOKEN"
```

### 8.5 `GET /api/tasks/:taskId/analysis`

- 权限：已登录。
- JSON 响应：无作业时 `{"job":null,"task":...}`；有作业时 `{"job":<AnalysisJob>,"task":...}`。
- SSE：加 `?stream=1&jobId=:jobId` 或 `Accept: text/event-stream`。
- SSE 事件：`analysis.stream.connected/queued/running/waiting/completed/failed/cancelled`。
- 状态码：`200/401/404/409/503`。
- 持久化：Worker SQLite 作业记录；任务保存当前 `analysisJobId`。

```bash
curl -N 'http://127.0.0.1:3000/api/tasks/task_xxx/analysis?stream=1&jobId=JOB_ID' \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: text/event-stream'
```

### 8.6 `POST /api/tasks/:taskId/analysis`

- 权限：`runs:execute`；同源校验。
- `{"action":"samples"}`：绑定并索引练习数据。
- `{"action":"cancel"}`：取消当前作业。
- 运行请求：`countsId/metadataId/condition/control/treated`，可选 `batch/alpha`。
- 响应：samples 返回 `task`；cancel/run 返回 `{"job":<AnalysisJob>,"task":<ResearchTask>}`。
- 状态码：`200/400/401/403/404/409/422`。
- 校验：文件必须绑定当前任务；输入必须为表格；分组和文件必须不同；当前真实计算器只支持 `rnaseq-deseq2`。

```bash
curl -sS -X POST http://127.0.0.1:3000/api/tasks/task_xxx/analysis \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"countsId":"COUNTS_ID","metadataId":"META_ID","condition":"condition","control":"control","treated":"treated","batch":"batch","alpha":0.05}'
```

### 8.7 `GET /api/tasks/:taskId/analysis/:name`

- 权限：已登录。
- `name` 白名单由 Worker 限制为 `results.csv/volcano.png/report.md/analysis.py`。
- 响应：二进制下载流；火山图返回 `image/png`。
- 状态码：`200/401/404/409/503`。
- 持久化：读取 `jobs/<jobId>/<artifact>`；生产映射 `artifacts.object_key`。

```bash
curl -sS http://127.0.0.1:3000/api/tasks/task_xxx/analysis/results.csv \
  -H "Authorization: Bearer $TOKEN" -o results.csv
```

## 9. 技能、布局与结构

### 9.1 `GET /api/skills`

- 权限：已登录。
- Query：`search/source/category/availability/page/pageSize`；默认每页 6 条。
- 响应：`CatalogPage<SkillRecord>`。
- 状态码：`200/401`。
- 持久化：种子目录 + `data/catalog-state.json` 的启用状态与自建技能。

```bash
curl -sS 'http://127.0.0.1:3000/api/skills?search=RNA&page=1&pageSize=6' \
  -H "Authorization: Bearer $TOKEN"
```

### 9.2 `POST /api/skills`

- 权限：`skills:write`；同源校验。
- 请求：声明式技能字段，包含 `name/category/description/source/version/inputs/outputs/instructions`。
- 响应：`201 {"skill":<SkillRecord>}`。
- 状态码：`201/400/401/403`。
- 安全边界：只保存配置，不执行用户上传代码。

```bash
curl -sS -X POST http://127.0.0.1:3000/api/skills \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"name":"通路富集审阅","category":"Data Analysis","description":"审阅富集结果与证据边界","source":"Mine","version":"1.0.0","inputs":"gene list","outputs":"review report"}'
```

### 9.3 `GET /api/skills/:skillId`

- 权限：已登录。
- 响应：`{"skill":<SkillRecord>}`。
- 状态码：`200/401/404`。

```bash
curl -sS http://127.0.0.1:3000/api/skills/rnaseq-deseq2 -H "Authorization: Bearer $TOKEN"
```

### 9.4 `PATCH /api/skills/:skillId`

- 权限：`skills:write`；同源校验。
- 请求：`{"enabled":true|false}`。
- 响应：`{"skill":<SkillRecord>}`。
- 状态码：`200/400/401/403/404`。

```bash
curl -sS -X PATCH http://127.0.0.1:3000/api/skills/SKILL_ID \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"enabled":true}'
```

### 9.5 `DELETE /api/skills/:skillId`

- 权限：`skills:write`；同源校验。
- 响应：`{"deletedSkillId":"...","disposition":"deleted|removed"}`。
- 状态码：`200/401/403/404`。
- 行为：自建技能会删除声明式配置；预置或共享技能只会从当前工作区目录移除，不会破坏内置能力定义。

```bash
curl -sS -X DELETE http://127.0.0.1:3000/api/skills/SKILL_ID \
  -H "Authorization: Bearer $TOKEN"
```

### 9.6 `GET/PUT/POST /api/workflows/:workflowId/layout?taskId=:taskId`

- GET 权限：已登录；响应 `{"layout":<WorkflowLayoutState>}`。
- PUT 权限：`tasks:write`；保存当前 `nodePositions/extraEdges/zoom/pan/revision`。
- POST 权限：`tasks:write`；请求额外包含 `name`，创建命名版本并返回 `layout/version`。
- 状态码：`200/401/403/404`。
- 持久化：`data/state.json.workflowLayouts[taskId]`；生产映射 `workflow_layouts`。

```bash
curl -sS 'http://127.0.0.1:3000/api/workflows/workflow_demo/layout?taskId=task_xxx' \
  -H "Authorization: Bearer $TOKEN"
curl -sS -X PUT 'http://127.0.0.1:3000/api/workflows/workflow_demo/layout?taskId=task_xxx' \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data '{"nodePositions":{},"extraEdges":[],"zoom":1,"pan":{"x":0,"y":0},"revision":1}'
```

### 9.7 `POST /api/workflows/:workflowId/approve`

- 权限：`tasks:write`；同源校验。
- 说明：兼容旧演示调用，内部审批默认任务；新代码应使用 `/api/tasks/:taskId/approve`。
- 响应：`{"task":<ResearchTask|null>}`。

```bash
curl -sS -X POST http://127.0.0.1:3000/api/workflows/workflow_demo/approve \
  -H "Authorization: Bearer $TOKEN"
```

### 9.8 `GET /api/structures/:accession?format=pdb|cif`

- 权限：已登录。
- 响应：结构 Adapter 状态与坐标内容/降级信息。
- 状态码：`200/401`。
- 边界：当前为本地 PDB fixture + Canvas 轻量预览；完整 Mol* 和外部 PDB API 未包装成已完成能力。

```bash
curl -sS 'http://127.0.0.1:3000/api/structures/P04637?format=pdb' \
  -H "Authorization: Bearer $TOKEN"
```

## 10. 演示与诊断

### 10.1 `GET/POST /api/demo/config`

- GET 权限：已登录；响应 `{"config":<DemoConfig>}`。
- POST 权限：`tasks:write`；同源校验；响应规范化配置。
- 持久化：`data/state.json.config`。

```bash
curl -sS http://127.0.0.1:3000/api/demo/config -H "Authorization: Bearer $TOKEN"
```

### 10.2 `POST /api/demo/reset`

- 权限：`tasks:write`；同源校验；仅开发环境。
- 响应：`{"task":<reset task>}`。
- 状态码：`200/401/403/404`。

```bash
curl -sS -X POST http://127.0.0.1:3000/api/demo/reset -H "Authorization: Bearer $TOKEN"
```

### 10.3 `POST /api/demo/cleanup`

- 权限：`users:manage`；同源校验；仅开发环境。
- 响应：测试夹具清理统计。
- 状态码：`200/401/403/404`。

```bash
curl -sS -X POST http://127.0.0.1:3000/api/demo/cleanup -H "Authorization: Bearer $TOKEN"
```

### 10.4 `GET /api/research/openapi`

- 权限：已登录。
- 响应：Research Service 的 `openapi.json` 下载流。
- 状态码：`200/401/503`。

```bash
curl -sS http://127.0.0.1:3000/api/research/openapi \
  -H "Authorization: Bearer $TOKEN" -o research-openapi.json
```

### 10.5 `GET /api/docs/:document`

- 权限：`tasks:read`。
- `document`：`api-contract` 或 `database-ddl`。
- Query：存在 `download` 时 attachment，否则 inline。
- 响应：UTF-8 Markdown 或 SQL 文本。
- 状态码：`200/401/404/503`。

```bash
curl -sS http://127.0.0.1:3000/api/docs/api-contract \
  -H "Authorization: Bearer $TOKEN" -o API接口规范.md
```

## 11. 当前持久化实体对照

| 当前本机实现 | 保存内容 | 生产目标 |
| --- | --- | --- |
| `data/state.json` | 任务、对话、笔记、布局、运行事件、RAG Trace | PostgreSQL `tasks/conversation_messages/workflow_*/runs/run_events/rag_*` |
| `data/catalog-state.json` | 技能启用状态与自建技能 | PostgreSQL `skills` |
| `$BIOFLOW_DATA_DIR/projects.json` | 项目目录 | PostgreSQL `projects/project_members` |
| `$BIOFLOW_DATA_DIR/auth-users.json` | 用户、scrypt 哈希、角色和权限 | PostgreSQL `users/roles/permissions` |
| `$BIOFLOW_DATA_DIR/research.sqlite` | `document/job` JSON 记录 | PostgreSQL `documents/document_chunks/analysis_jobs` |
| `$BIOFLOW_DATA_DIR/qdrant` | 真实向量索引 | Qdrant Server collection |
| `$BIOFLOW_DATA_DIR/objects` | 原始上传文件 | S3/MinIO/OSS 对象存储 |
| `$BIOFLOW_DATA_DIR/jobs` | PyDESeq2 结果与日志 | 对象存储 + 专用计算队列 |

完整生产目标表结构见 [`数据库设计.sql`](./数据库设计.sql)。当前本地混合持久化是为了让面试电脑在零 Docker、零外部数据库运维下通过单命令启动，不代表生产环境应继续使用单文件 JSON 或 SQLite JSON blob。
