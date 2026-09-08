import fs from "node:fs";
import path from "node:path";
import { isAuthorized } from "@/lib/auth";

const documents = {
  "api-contract": {
    fileName: "BioFlow-Studio-API接口规范.md",
    path: path.join(process.cwd(), "docs", "API接口规范.md"),
    contentType: "text/markdown; charset=utf-8",
  },
  "database-ddl": {
    fileName: "BioFlow-Studio-数据库设计.sql",
    path: path.join(process.cwd(), "docs", "数据库设计.sql"),
    contentType: "application/sql; charset=utf-8",
  },
} as const;

export async function GET(request: Request, { params }: { params: { document: string } }) {
  if (!isAuthorized("tasks:read")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const document = documents[params.document as keyof typeof documents];
  if (!document) return Response.json({ error: "文档不存在" }, { status: 404 });

  try {
    const content = fs.readFileSync(document.path);
    const disposition = new URL(request.url).searchParams.has("download") ? "attachment" : "inline";
    return new Response(content, {
      headers: {
        "Content-Type": document.contentType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "交付文档暂不可用" }, { status: 503 });
  }
}
