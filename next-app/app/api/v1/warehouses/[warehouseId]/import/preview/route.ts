import { NextRequest } from "next/server";
import { withApi, jsonBody } from "@/lib/http";
import { BASELINE } from "@/lib/seed";
import { validateLegacySnapshot } from "@/lib/legacy";
export async function POST(request: NextRequest, { params }: { params: Promise<{ warehouseId: string }> }) {
  const { warehouseId } = await params;
  return withApi(request, warehouseId, async () => { const body = await jsonBody<{ idempotencyKey: string; snapshot?: unknown }>(request); try { const snapshot = validateLegacySnapshot(body?.snapshot); return { ok: true, valid: true, baseline: BASELINE, observed: { containers: snapshot.containers.length, items: snapshot.containers.reduce((n, c) => n + c.items.length, 0), expected: snapshot.containers.reduce((n, c) => n + c.items.reduce((sum, item) => sum + item.expected, 0), 0) } }; } catch (error) { return { ok: true, valid: false, baseline: BASELINE, error: error instanceof Error ? error.message : "Invalid snapshot" }; } });
}
