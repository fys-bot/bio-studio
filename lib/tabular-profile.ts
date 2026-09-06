import { createHash } from "crypto";
import type { DataFileProfile, GroupFieldCandidate, TabularColumnProfile } from "./domain";

const missingValueTokens = new Set(["", "na", "n/a", "null", "nan", "."]);
const sampleFieldNames = new Set([
  "sample",
  "sampleid",
  "samplename",
  "sample_id",
  "sample_name",
  "library",
  "libraryid",
]);
const conditionFieldNames = new Set([
  "condition",
  "group",
  "treatment",
  "cohort",
  "phenotype",
  "status",
  "class",
]);
const geneFieldNames = new Set([
  "gene",
  "geneid",
  "gene_id",
  "genesymbol",
  "gene_symbol",
  "ensemblid",
]);

type ProfileTabularFileInput = {
  fileName: string;
  sizeBytes: number;
  text: string;
};

const normalizeFieldName = (fieldName: string) =>
  fieldName
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const isMissingValue = (value: string) => missingValueTokens.has(value.trim().toLowerCase());

/** 解析 RFC 4180 常见引号和换行场景，不依赖浏览器端读取原始研究数据。 */
function parseDelimitedRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let insideQuotedValue = false;

  for (let characterIndex = 0; characterIndex < text.length; characterIndex += 1) {
    const character = text[characterIndex];
    const nextCharacter = text[characterIndex + 1];

    if (character === '"') {
      if (insideQuotedValue && nextCharacter === '"') {
        currentValue += '"';
        characterIndex += 1;
      } else {
        insideQuotedValue = !insideQuotedValue;
      }
      continue;
    }

    if (character === delimiter && !insideQuotedValue) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotedValue) {
      if (character === "\r" && nextCharacter === "\n") characterIndex += 1;
      currentRow.push(currentValue);
      if (currentRow.some((value) => value.trim())) rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  currentRow.push(currentValue);
  if (currentRow.some((value) => value.trim())) rows.push(currentRow);
  return rows;
}

function inferColumnType(
  columnName: string,
  values: string[],
): TabularColumnProfile["inferredType"] {
  const populatedValues = values.filter((value) => !isMissingValue(value));
  if (populatedValues.length === 0) return "text";

  const normalizedName = normalizeFieldName(columnName);
  const distinctCount = new Set(populatedValues).size;
  const distinctRatio = distinctCount / populatedValues.length;
  const numericCount = populatedValues.filter((value) => Number.isFinite(Number(value))).length;
  const dateCount = populatedValues.filter((value) => !Number.isNaN(Date.parse(value))).length;

  if (sampleFieldNames.has(normalizedName) || normalizedName.endsWith("_id")) {
    return "identifier";
  }
  if (numericCount / populatedValues.length >= 0.95) return "number";
  if (dateCount / populatedValues.length >= 0.95) return "date";
  if (distinctCount <= 20 || distinctRatio <= 0.2) return "category";
  return "text";
}

function scoreGroupCandidates(
  columns: TabularColumnProfile[],
  columnValues: string[][],
  recordCount: number,
): GroupFieldCandidate[] {
  return columns
    .map((column, columnIndex) => {
      const normalizedName = normalizeFieldName(column.name);
      const missingRatio = recordCount ? column.missingCount / recordCount : 1;
      let score = 0;
      const reasons: string[] = [];

      if (conditionFieldNames.has(normalizedName)) {
        score += normalizedName === "condition" || normalizedName === "group" ? 80 : 65;
        reasons.push("字段名符合实验分组惯例");
      }
      if (column.distinctCount >= 2 && column.distinctCount <= 12) {
        score += 20;
        reasons.push(`${column.distinctCount} 个分组水平`);
      }
      if (column.inferredType === "category") score += 12;
      if (column.inferredType === "number") score -= 25;
      if (missingRatio > 0.2) score -= 20;

      const populatedCount = columnValues[columnIndex].filter(
        (value) => !isMissingValue(value),
      ).length;
      if (populatedCount === 0) score = 0;

      return {
        columnName: column.name,
        distinctCount: column.distinctCount,
        score: Math.max(0, score),
        reason: reasons.join("；") || "字段信息不足，需要人工确认",
      };
    })
    .filter((candidate) => candidate.score >= 20)
    .sort((leftCandidate, rightCandidate) => rightCandidate.score - leftCandidate.score)
    .slice(0, 3);
}

export function profileTabularFile({
  fileName,
  sizeBytes,
  text,
}: ProfileTabularFileInput): DataFileProfile {
  const normalizedFileName = fileName.toLowerCase();
  const format = normalizedFileName.endsWith(".tsv") ? "TSV" : "CSV";
  const delimiter = format === "TSV" ? "\t" : ",";
  const rows = parseDelimitedRows(text.replace(/^\uFEFF/, ""), delimiter);

  if (rows.length < 2) {
    throw new Error("文件至少需要包含表头和一行数据");
  }

  const rawHeaders = rows[0];
  if (rawHeaders.length > 512) {
    throw new Error("字段数超过 512 列，请拆分文件后重试");
  }
  const headers = rawHeaders.map((header, columnIndex) =>
    header.trim() ? header.trim() : `未命名列_${columnIndex + 1}`,
  );
  const dataRows = rows.slice(1);
  if (dataRows.length > 100_000) {
    throw new Error("记录数超过 100,000 行，请先进行抽样或拆分");
  }
  const columnValues = headers.map((_, columnIndex) =>
    dataRows.map((row) => row[columnIndex] ?? ""),
  );
  const columns = headers.map((header, columnIndex): TabularColumnProfile => {
    const values = columnValues[columnIndex];
    const populatedValues = values.filter((value) => !isMissingValue(value));
    return {
      name: header,
      inferredType: inferColumnType(header, values),
      missingCount: values.length - populatedValues.length,
      distinctCount: new Set(populatedValues).size,
    };
  });

  const normalizedHeaders = headers.map(normalizeFieldName);
  const sampleFieldIndex = normalizedHeaders.findIndex((header) => sampleFieldNames.has(header));
  const explicitConditionIndex = normalizedHeaders.findIndex((header) =>
    conditionFieldNames.has(header),
  );
  const groupCandidates = scoreGroupCandidates(columns, columnValues, dataRows.length);
  const suggestedConditionField =
    explicitConditionIndex >= 0 ? headers[explicitConditionIndex] : groupCandidates[0]?.columnName;
  const firstFieldName = normalizedHeaders[0];
  const looksLikeCountMatrix =
    geneFieldNames.has(firstFieldName) ||
    (sampleFieldIndex < 0 &&
      columns.length >= 4 &&
      columns.slice(1).every((column) => column.inferredType === "number"));
  const dataRole = looksLikeCountMatrix
    ? "count_matrix"
    : sampleFieldIndex >= 0 || suggestedConditionField
      ? "sample_metadata"
      : "tabular";
  const sampleCount =
    dataRole === "count_matrix" ? Math.max(0, headers.length - 1) : dataRows.length;
  const missingCellCount = columns.reduce(
    (totalMissingCount, column) => totalMissingCount + column.missingCount,
    0,
  );
  const warnings: string[] = [];

  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    warnings.push("存在重复字段名，运行前需要重命名");
  }
  if (dataRows.some((row) => row.length !== headers.length)) {
    warnings.push("部分记录的列数与表头不一致");
  }
  if (missingCellCount > 0) warnings.push(`检测到 ${missingCellCount} 个缺失值`);

  const status = dataRole === "count_matrix" || suggestedConditionField ? "ready" : "needs_mapping";
  const recommendations =
    dataRole === "count_matrix"
      ? [`识别为 Count 矩阵，建议从 ${sampleCount} 个样本开始差异表达分析`]
      : suggestedConditionField
        ? [
            `建议将 ${suggestedConditionField} 映射为实验分组字段`,
            "比较方案建议使用“处理组 vs 对照组”",
          ]
        : ["未自动识别实验分组字段，请在运行前完成字段映射"];

  return {
    id: createHash("sha256").update(`${fileName}:${sizeBytes}:${text}`).digest("hex").slice(0, 16),
    fileName,
    format,
    sizeBytes,
    dataRole,
    recordCount: dataRows.length,
    sampleCount,
    columnCount: headers.length,
    missingCellCount,
    columns,
    groupCandidates,
    recognizedFields: {
      sample: sampleFieldIndex >= 0 ? headers[sampleFieldIndex] : undefined,
      condition: suggestedConditionField,
    },
    status,
    recommendations,
    warnings,
    analyzedAt: new Date().toISOString(),
  };
}
