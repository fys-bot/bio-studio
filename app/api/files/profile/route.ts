import { NextResponse } from "next/server";
import { authGuard, isSameOrigin } from "@/lib/auth";
import { attachTaskFiles, saveDataFileProfile, taskSnapshot } from "@/lib/store";
import { profileTabularFile } from "@/lib/tabular-profile";
import { researchJson, type ResearchDocument } from "@/lib/research-service";
import type { DataFileProfile } from "@/lib/domain";

export const runtime = "nodejs";
const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;
export async function POST(request: Request) {
  const denied = authGuard("files:write");
  if (denied) return denied;
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const taskId = new URL(request.url).searchParams.get("taskId") || "task_demo_rnaseq";
  if (!taskSnapshot(taskId)) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (
    !(file instanceof File) ||
    !/\.(csv|tsv|txt|md|xlsx|pdf|docx|png|jpe?g)$/i.test(file.name) ||
    !file.size ||
    file.size > MAX_UPLOAD_BYTES
  )
    return NextResponse.json({ error: "请选择 300MB 以内的受支持文档" }, { status: 400 });
  try {
    const forwarded = new FormData();
    forwarded.append("file", file);
    const doc = await researchJson<ResearchDocument>(
      "/documents",
      { method: "POST", body: forwarded },
      120_000,
    );
    const base = /\.(csv|tsv)$/i.test(file.name)
      ? profileTabularFile({
          fileName: doc.name,
          sizeBytes: doc.sizeBytes,
          text: await file.text(),
        })
      : null;
    const profile: DataFileProfile = {
      id: doc.id,
      fileName: doc.name,
      format: doc.format as DataFileProfile["format"],
      sizeBytes: doc.sizeBytes,
      dataRole: base?.dataRole || "document",
      recordCount: base?.recordCount ?? doc.sections.length,
      sampleCount: base?.sampleCount ?? 0,
      columnCount: base?.columnCount ?? 0,
      missingCellCount: base?.missingCellCount ?? 0,
      columns: base?.columns ?? [],
      groupCandidates: base?.groupCandidates ?? [],
      recognizedFields: base?.recognizedFields ?? {},
      status: doc.needsOcr ? "needs_mapping" : base?.status || "ready",
      recommendations: base?.recommendations ?? [doc.parser],
      warnings: [...(base?.warnings ?? []), ...doc.warnings],
      analyzedAt: new Date().toISOString(),
    };
    saveDataFileProfile(profile, taskId);
    const task = attachTaskFiles(taskId, [doc.id]);
    return NextResponse.json({ profile, document: doc, task });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "解析失败" },
      { status: 422 },
    );
  }
}
