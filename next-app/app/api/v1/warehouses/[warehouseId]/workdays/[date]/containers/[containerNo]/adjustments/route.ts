import { NextRequest } from "next/server";
import { adjustItem } from "@/lib/firestore";
import { withApi, jsonBody } from "@/lib/http";
import type { AdjustmentCommand } from "@/lib/types";
import { parseAdjustment } from "@/lib/validation";
import { validatePath } from "@/lib/validation";
export async function POST(request: NextRequest, { params }: { params: Promise<{ warehouseId: string; date: string; containerNo: string }> }) {
  const p = await params; return withApi(request, p.warehouseId, async (actor) => { validatePath(p.warehouseId, p.date, p.containerNo); return adjustItem(p.warehouseId, p.date, p.containerNo, parseAdjustment(await jsonBody<AdjustmentCommand>(request)), actor); });
}
