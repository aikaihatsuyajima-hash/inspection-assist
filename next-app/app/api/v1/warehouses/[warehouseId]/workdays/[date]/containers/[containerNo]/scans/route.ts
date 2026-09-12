import { NextRequest } from "next/server";
import { recordScan } from "@/lib/firestore";
import { withApi, jsonBody } from "@/lib/http";
import type { ScanCommand } from "@/lib/types";
import { parseScan } from "@/lib/validation";
import { validatePath } from "@/lib/validation";
export async function POST(request: NextRequest, { params }: { params: Promise<{ warehouseId: string; date: string; containerNo: string }> }) {
  const p = await params; return withApi(request, p.warehouseId, async (actor) => { validatePath(p.warehouseId, p.date, p.containerNo); return recordScan(p.warehouseId, p.date, p.containerNo, parseScan(await jsonBody<ScanCommand>(request)), actor); });
}
