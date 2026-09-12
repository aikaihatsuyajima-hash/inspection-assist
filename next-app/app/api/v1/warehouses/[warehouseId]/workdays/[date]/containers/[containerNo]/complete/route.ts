import { NextRequest } from "next/server";
import { completeContainer } from "@/lib/firestore";
import { withApi, jsonBody } from "@/lib/http";
import { parseComplete } from "@/lib/validation";
import { validatePath } from "@/lib/validation";
export async function POST(request: NextRequest, { params }: { params: Promise<{ warehouseId: string; date: string; containerNo: string }> }) {
  const p = await params; return withApi(request, p.warehouseId, async (actor) => { validatePath(p.warehouseId, p.date, p.containerNo); const body = parseComplete(await jsonBody<{ idempotencyKey: string; unsynced?: number }>(request)); return completeContainer(p.warehouseId, p.date, p.containerNo, body.idempotencyKey, actor, body.unsynced); });
}
