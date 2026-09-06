import { NextResponse } from "next/server";
import { isAuthorized, isSameOrigin } from "@/lib/auth";
import { saveDataFileProfile } from "@/lib/store";
import { profileTabularFile } from "@/lib/tabular-profile";

export const runtime = "nodejs";

const maximumUploadSizeBytes = 5 * 1024 * 1024;
const supportedFilePattern = /\.(csv|tsv)$/i;

export async function POST(request: Request) {
  if (!isAuthorized()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const uploadedFile = formData?.get("file");

  if (!(uploadedFile instanceof File)) {
    return NextResponse.json({ error: "请选择需要分析的 CSV 或 TSV 文件" }, { status: 400 });
  }
  if (!supportedFilePattern.test(uploadedFile.name)) {
    return NextResponse.json({ error: "当前仅支持 CSV 和 TSV 结构解析" }, { status: 400 });
  }
  if (uploadedFile.size === 0 || uploadedFile.size > maximumUploadSizeBytes) {
    return NextResponse.json({ error: "文件大小必须在 1 B 到 5 MB 之间" }, { status: 400 });
  }

  const safeFileName = uploadedFile.name.replace(/[\\/\0]/g, "_").slice(0, 160);

  try {
    const profile = profileTabularFile({
      fileName: safeFileName,
      sizeBytes: uploadedFile.size,
      text: await uploadedFile.text(),
    });
    const task = saveDataFileProfile(profile);
    return NextResponse.json({ profile, task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "文件结构解析失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
