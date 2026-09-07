import type { DataFileProfile } from "./domain";

const processingStages = (
  parser: string,
  extractedStatus: "succeeded" | "pending",
  extractedDetail: string,
  chunkCount: number,
): NonNullable<DataFileProfile["processing"]> => ({
  parser,
  stages: [
    { key: "received", label: "接收文件", status: "succeeded", detail: "文件已接收并完成大小校验" },
    { key: "detected", label: "类型识别", status: "succeeded", detail: `识别为 ${parser}` },
    { key: "extracted", label: "内容提取", status: extractedStatus, detail: extractedDetail },
    {
      key: "cleaned",
      label: "内容清洗",
      status: extractedStatus === "succeeded" ? "succeeded" : "pending",
      detail: extractedStatus === "succeeded" ? "已移除空段落并规范空白" : "等待正文提取",
    },
    {
      key: "chunked",
      label: "语义切块",
      status: extractedStatus === "succeeded" ? "succeeded" : "pending",
      detail: extractedStatus === "succeeded" ? `${chunkCount} 个上下文单元` : "等待清洗完成",
    },
    {
      key: "indexed",
      label: "向量索引",
      status: extractedStatus === "succeeded" ? "succeeded" : "pending",
      detail: extractedStatus === "succeeded" ? "local-vector-adapter 已写入" : "等待可索引文本",
    },
  ],
  index: {
    provider: "local-vector-adapter",
    collection: "bioflow_project_documents",
    dimensions: 32,
    status: extractedStatus === "succeeded" ? "indexed" : "pending",
    chunkCount,
  },
});

export function profileTextDocument(input: {
  fileName: string;
  sizeBytes: number;
  format: "TXT" | "MD";
  text: string;
}): DataFileProfile {
  const lines = input.text.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim()).length;
  const headingCount = lines.filter((line) => /^\s{0,3}#{1,6}\s+/.test(line)).length;
  const wordCount = input.text.trim() ? input.text.trim().split(/\s+/).length : 0;

  return {
    id: `profile_${input.fileName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${input.sizeBytes}`,
    fileName: input.fileName,
    format: input.format,
    sizeBytes: input.sizeBytes,
    dataRole: "document",
    recordCount: nonEmptyLines,
    sampleCount: 0,
    columnCount: headingCount,
    missingCellCount: 0,
    columns: [],
    groupCandidates: [],
    recognizedFields: {},
    status: "ready",
    recommendations: [
      `已提取 ${wordCount.toLocaleString()} 个词、${nonEmptyLines} 个非空段落`,
      headingCount
        ? `识别到 ${headingCount} 个 Markdown 标题，可用于组织证据上下文`
        : "可作为研究背景与方法依据进入 RAG 上下文",
    ],
    warnings: input.text.trim() ? [] : ["文档为空，无法生成上下文"],
    analyzedAt: new Date().toISOString(),
    processing: processingStages(
      "TextDocumentParser",
      "succeeded",
      "已提取纯文本内容",
      nonEmptyLines,
    ),
  };
}

export function profileBinaryDocument(input: {
  fileName: string;
  sizeBytes: number;
  format: "XLSX" | "PDF" | "DOCX";
  bytes: Uint8Array;
}): DataFileProfile {
  const binary = Buffer.from(input.bytes).toString("latin1");
  const isZip = binary.startsWith("PK");
  const isPdf = binary.startsWith("%PDF");
  const pageCount =
    input.format === "PDF" ? Math.max(1, (binary.match(/\/Type\s*\/Page\b/g) || []).length) : 0;
  const sheetCount =
    input.format === "XLSX"
      ? Math.max(1, (binary.match(/xl\/worksheets\/sheet\d+\.xml/g) || []).length)
      : 0;
  const paragraphCount =
    input.format === "DOCX" ? Math.max(1, (binary.match(/w:p[ >]/g) || []).length) : 0;
  const recognized = (input.format === "PDF" && isPdf) || (input.format !== "PDF" && isZip);
  const count = pageCount || sheetCount || paragraphCount;
  const parser =
    input.format === "PDF"
      ? "PdfTextOcrAdapter"
      : input.format === "XLSX"
        ? "XlsxWorkbookAdapter"
        : "DocxOpenXmlAdapter";
  const extracted = recognized ? "pending" : "pending";
  const detail = recognized
    ? "已识别文件容器，当前演示环境等待正文/OCR 解析器"
    : "文件签名未通过校验，请重新上传或接入对应解析器";
  return {
    id: `profile_${input.fileName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${input.sizeBytes}`,
    fileName: input.fileName,
    format: input.format,
    sizeBytes: input.sizeBytes,
    dataRole: "document",
    recordCount: count,
    sampleCount: 0,
    columnCount: 0,
    missingCellCount: 0,
    columns: [],
    groupCandidates: [],
    recognizedFields: {},
    status: "needs_mapping",
    recommendations: [
      recognized ? `${input.format} 容器识别完成，需启用 ${parser} 提取正文` : "文件格式签名异常",
      "提取完成后将进入清洗、切块和向量索引流程",
    ],
    warnings: recognized
      ? ["当前环境未安装生产级 PDF/OCR/Office 正文解析器"]
      : ["文件内容无法识别"],
    analyzedAt: new Date().toISOString(),
    processing: processingStages(parser, extracted, detail, count),
  };
}
