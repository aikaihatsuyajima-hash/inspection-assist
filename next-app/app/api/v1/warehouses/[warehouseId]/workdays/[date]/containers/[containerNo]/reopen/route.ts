import { NextRequest } from "next/server";
import { reopenContainer } from "@/lib/firestore";
import { withApi, jsonBody } from "@/lib/http";
import { parseComplete, validatePath } from "@/lib/validation";
import { assertRole } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ warehouseId: string; date: string; containerNo: string }> }) {
  const p = await params;
  return withApi(request, p.warehouseId, async (actor, principal) => {
    validatePath(p.warehouseId, p.date, p.containerNo);
    assertRole(principal, ["manager", "admin"]);
    const body = parseComplete(await jsonBody<{ idempotencyKey: string }>(request));
    return reopenContainer(p.warehouseId, p.date, p.containerNo, body.idempotencyKey, actor);
  });
}
