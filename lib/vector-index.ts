import fs from "node:fs";
import path from "node:path";
import type { DataFileProfile } from "./domain";

type VectorIndexEntry = {
  id: string;
  taskId: string;
  fileName: string;
  text: string;
  vector: number[];
  updatedAt: string;
};

type VectorIndexState = { entries: VectorIndexEntry[] };

const indexPath = path.join(process.cwd(), "data", "rag-index.json");
const dimensions = 32;

function readIndex(): VectorIndexState {
  try {
    return JSON.parse(fs.readFileSync(indexPath, "utf8")) as VectorIndexState;
  } catch {
    return { entries: [] };
  }
}

function writeIndex(index: VectorIndexState) {
  try {
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  } catch {
    // 只读部署保留内存级 Trace，生产环境替换为向量数据库 Adapter。
  }
}

function vectorize(text: string) {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const [index, character] of [...text.toLowerCase()].entries()) {
    vector[index % dimensions] += character.charCodeAt(0) / 255;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

function textForProfile(profile: DataFileProfile, sourceText: string) {
  if (profile.dataRole === "document" && sourceText.trim()) return sourceText;
  return [
    profile.fileName,
    profile.dataRole,
    profile.recommendations.join(" "),
    profile.warnings.join(" "),
    profile.columns.map((column) => column.name).join(" "),
  ].join("\n");
}

export function upsertDocumentIndex(taskId: string, profile: DataFileProfile, sourceText: string) {
  const index = readIndex();
  if (profile.processing?.index.status !== "indexed") {
    writeIndex({
      entries: index.entries.filter(
        (entry) => !(entry.taskId === taskId && entry.fileName === profile.fileName),
      ),
    });
    return 0;
  }
  const text = textForProfile(profile, sourceText).slice(0, 80_000);
  const chunks = text
    .split(/\n{2,}|(?<=[。.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 500);
  const entries = index.entries.filter(
    (entry) => !(entry.taskId === taskId && entry.fileName === profile.fileName),
  );
  const nextEntries = chunks.map((chunk, chunkIndex) => ({
    id: `vec_${profile.id}_${chunkIndex + 1}`,
    taskId,
    fileName: profile.fileName,
    text: chunk,
    vector: vectorize(chunk),
    updatedAt: new Date().toISOString(),
  }));
  writeIndex({ entries: [...entries, ...nextEntries].slice(-5000) });
  return nextEntries.length;
}

export function searchDocumentIndex(taskId: string, query: string, limit = 6) {
  const queryVector = vectorize(query);
  return readIndex()
    .entries.filter((entry) => entry.taskId === taskId)
    .map((entry) => ({
      ...entry,
      score: Number(
        entry.vector.reduce((sum, value, index) => sum + value * queryVector[index], 0).toFixed(3),
      ),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function indexCount(taskId: string) {
  return readIndex().entries.filter((entry) => entry.taskId === taskId).length;
}

export const vectorIndexDimensions = dimensions;
