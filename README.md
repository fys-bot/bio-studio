# BioFlow Studio

生命科学任务工作台。新建任务支持真实文档解析、可追溯检索和异步 PyDESeq2 分析；旧 RNA-seq 演示任务单独标记为演示数据。

## 启动

Node.js 20+、Python 3.12 推荐。首次安装：

```bash
npm install
python3 -m venv .venv
.venv/bin/pip install -r services/requirements.txt
npm run dev
```

固定前端入口 [http://127.0.0.1:3000](http://127.0.0.1:3000)。启动器会检查并启动内部科研服务（8000），不会关闭其他占用端口的进程。服务也可独立运行：

```bash
npm run services
```

开发缓存是 `.next-dev`，构建缓存是 `.next-verification`，可同时运行开发与验证构建。

## 从 0 到 1

1. 打开能力中心，点击 DESeq2 卡片任意正文区域进入详情。
2. 点击“使用此技能创建任务”，新任务保存技能 ID、版本、输入输出。
3. 上传 Count 矩阵及样本元数据，或点击“使用示例数据”绑定合成练习文件。
4. 完成澄清并“批准计划”。在“输入与计算”检查文件、分组标签、批次和 FDR。
5. 点击“运行 PyDESeq2”，等任务从 queued/running 进入 succeeded；错误输入会显示具体原因。
6. 查看真实火山图与结果表，下载 CSV、PNG、Markdown 和分析脚本。
7. 文件中心点击文件可查看正文、表格、来源位置，下载原件，或用此文件创建任务。
8. 文件 indexed 后在任务里提问，可获得 Qdrant + BM25/RRF 返回的真实来源片段。

工作台“文档”包含操作指南、接口和 RAG 说明。Research Service 的 OpenAPI 可从该面板下载。

## 技术栈与边界

- 解析：pypdf / openpyxl / python-docx；扫描 PDF 和图片按策略调用可配置 Ollama 视觉模型。
- 检索：FastEmbed / ONNX multilingual MiniLM（384 维），Qdrant Local Mode 持久化，BM25 + cosine + RRF。
- 计算：PyDESeq2 0.5.4 独立子进程；SQLite 持久化排队与状态，支持取消、失败及重试。
- 原文件和解析结果保存在本机 `data/runtime`；授权预览返回正文和表格，不再只有元信息。
- 未配置 `BIOFLOW_OCR_MODEL` 时扫描文档明确显示需要 OCR，不伪造全文或索引成功。
- 真实 LLM Agent、cross-encoder、知识图谱、其他科研计算器和生产多租户暂未完成。

完整选型、来源、数据边界和验收见 [真实科研链路-选型与验收](./docs/真实科研链路-选型与验收.md)。历史待办文件含旧阶段记录，不应作为当前完成度依据。

## 检查

```bash
npm test
npm run test:parsers
npm run smoke
```

默认 smoke 使用 3000，创建自己的测试任务，不重置用户状态。旧演示测试保留为 `npm run smoke:legacy`。

## 配置与数据

查看 [.env.example](./.env.example)。真实研究服务需要前后端一致的 `BIOFLOW_WORKER_TOKEN`；开发默认令牌仅限本机，不可用于部署。

- `QDRANT_URL` / `QDRANT_API_KEY`：切换 Qdrant Server。
- `BIOFLOW_OCR_MODEL` / `BIOFLOW_OCR_URL`：启用视觉 OCR；默认请求本机 Ollama，配置远程地址前应确认数据外发权限。
- `BIOFLOW_DATA_DIR`：科研文件、元数据、索引和作业目录；模型缓存默认同目录下 models。
- 服务端点不执行用户上传脚本或自定义技能代码。新建技能保存的是声明式配置。

## 交付材料

- [竞品分析](./analysis.md)
- [架构与交付说明（历史）](./docs/架构与交付说明.md)
- [操作流程手册](./deliverables/BioFlow-Studio操作流程手册.docx)
- [视觉与交互规范](./deliverables/BioFlow-Studio视觉与交互规范-交付版.pptx)

DOCX/PPTX 是前一阶段材料；当前新增真实服务的说明以本 README 和本轮选型验收文档为准。
