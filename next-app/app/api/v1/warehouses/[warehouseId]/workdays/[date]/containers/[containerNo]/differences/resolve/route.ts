import { NextRequest } from "next/server";
import { resolveDifference } from "@/lib/firestore";
import { RepositoryError } from "@/lib/firestore";
import { withApi, jsonBody } from "@/lib/http";
import { parseComplete, validatePath } from "@/lib/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ warehouseId: string; date: string; containerNo: string }> }) {
  const p = await params;
  return withApi(request, p.warehouseId, async (actor) => {
    validatePath(p.warehouseId, p.date, p.containerNo);
    const body = await jsonBody<{ idempotencyKey: string; count?: unknown }>(request);
    const identity = parseComplete(body);
    const count = body.count === undefined ? 1 : body.count;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 100) throw new RepositoryError("count must be 1..100", 400);
    return resolveDifference(p.warehouseId, p.date, p.containerNo, identity.idempotencyKey, actor, count);
  });
}
