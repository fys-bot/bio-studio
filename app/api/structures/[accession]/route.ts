import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { demoStructureAdapter } from "@/lib/structure-adapter";

export async function GET(request: Request, context: { params: { accession: string } }) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const format = new URL(request.url).searchParams.get("format") === "cif" ? "cif" : "pdb";
  const result = await demoStructureAdapter.load({ accession: context.params.accession, format });
  return NextResponse.json(result);
}
