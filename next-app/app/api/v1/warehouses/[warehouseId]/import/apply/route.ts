import { NextRequest } from "next/server";
import { withApi, jsonBody } from "@/lib/http";
import { writeImportRun } from "@/lib/firestore";
import { assertRole } from "@/lib/auth";
export async function POST(request: NextRequest, { params }: { params: Promise<{ warehouseId: string }> }) {
  const { warehouseId } = await params;
  return withApi(request, warehouseId, async (actor, principal) => { assertRole(principal, ["manager", "admin"]); const body = await jsonBody<{ idempotencyKey: string; containers?: unknown[] }>(request); const result = await writeImportRun(warehouseId, actor, body, "apply"); return { ok: true, ...result }; });
}
