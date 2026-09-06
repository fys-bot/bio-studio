"use client";

import Link from "next/link";
import { useState } from "react";

type FileItem = {
  name: string;
  type: string;
  role: string;
  size: string;
  status: string;
  updatedAt: string;
  detail: string;
};
const seedFiles: FileItem[] = [
  {
    name: "counts.csv",
    type: "CSV",
    role: "RNA-seq Count 矩阵",
    size: "2.4 MB",
    status: "结构已就绪",
    updatedAt: "刚刚",
    detail: "24 个样本 · 18,432 个基因 · gene_id + sample columns",
  },
  {
    name: "sample_metadata.tsv",
    type: "TSV",
    role: "样本元数据",
    size: "12 KB",
    status: "结构已就绪",
    updatedAt: "刚刚",
    detail: "24 个样本 · condition / batch 字段已识别",
  },
  {
    name: "研究方案.pdf",
    type: "PDF",
    role: "实验方案与方法",
    size: "860 KB",
    status: "待解析",
    updatedAt: "昨天",
    detail: "将进入文档解析与语义切分队列",
  },
  {
    name: "候选基因列表.txt",
    type: "TXT",
    role: "候选基因输入",
    size: "4 KB",
    status: "已索引",
    updatedAt: "2026-09-05",
    detail: "128 个基因符号 · 已关联 Reactome 图谱",
  },
];

export function FileCatalog() {
  const [files, setFiles] = useState(seedFiles);
  const [selected, setSelected] = useState<FileItem | null>(null);
  const [filter, setFilter] = useState("全部");
  const visible = files.filter((file) => filter === "全部" || file.status === filter);
  const reparse = (file: FileItem) => {
    setFiles((items) =>
      items.map((item) => (item.name === file.name ? { ...item, status: "解析完成" } : item)),
    );
    setSelected({ ...file, status: "解析完成" });
  };
  return (
    <main className="catalog-page">
      <header className="catalog-header">
        <div>
          <Link href="/" className="back-link">
            ← 返回工作台
          </Link>
          <span className="catalog-kicker">PROJECT FILES / 文件中心</span>
          <h1>让每份数据都可被智能体理解</h1>
          <p>
            文件先经过结构解析、权限校验和索引，再参与 RAG 召回；原始单元格不会直接展示在浏览器。
          </p>
        </div>
        <label className="primary upload-button">
          ＋ 上传文件
          <input
            type="file"
            accept=".csv,.tsv,.pdf,.txt"
            onChange={(event) => {
              const name = event.target.files?.[0]?.name;
              if (name)
                setFiles((items) => [
                  ...items,
                  {
                    name,
                    type: name.split(".").pop()?.toUpperCase() || "FILE",
                    role: "新上传文件",
                    size: "待计算",
                    status: "待解析",
                    updatedAt: "刚刚",
                    detail: "等待服务端解析",
                  },
                ]);
            }}
          />
        </label>
      </header>
      <section className="catalog-toolbar file-toolbar">
        <div className="filter-row">
          {["全部", "结构已就绪", "待解析", "已索引"].map((item) => (
            <button
              key={item}
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="catalog-meta-inline">{visible.length} 个文件 · 项目 proj_a5211690a4</span>
      </section>
      <section className="file-list">
        {visible.map((file) => (
          <button className="file-row" key={file.name} onClick={() => setSelected(file)}>
            <span className="file-type">{file.type}</span>
            <span className="file-main">
              <b>{file.name}</b>
              <small>
                {file.role} · {file.detail}
              </small>
            </span>
            <span className={`file-status ${file.status === "待解析" ? "pending" : "ready"}`}>
              {file.status}
            </span>
            <span className="file-size">
              {file.size}
              <br />
              <small>{file.updatedAt}</small>
            </span>
            <span>→</span>
          </button>
        ))}
      </section>
      {selected && (
        <div className="ui-modal-backdrop" onMouseDown={() => setSelected(null)}>
          <section
            className="ui-modal file-detail-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>文件画像</small>
                <h2>{selected.name}</h2>
              </div>
              <button onClick={() => setSelected(null)} aria-label="关闭文件详情">
                ×
              </button>
            </header>
            <div className="modal-detail">
              <p>{selected.detail}</p>
              <dl>
                <div>
                  <dt>文件角色</dt>
                  <dd>{selected.role}</dd>
                </div>
                <div>
                  <dt>解析状态</dt>
                  <dd>{selected.status}</dd>
                </div>
                <div>
                  <dt>RAG 用途</dt>
                  <dd>可作为项目文件来源参与召回与参数 grounding</dd>
                </div>
              </dl>
              <button className="primary full" onClick={() => reparse(selected)}>
                重新解析并更新索引
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
