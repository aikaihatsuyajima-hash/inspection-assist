import { NextRequest } from "next/server";
import { readWorkday } from "@/lib/firestore";
import { withApi } from "@/lib/http";
export async function GET(request: NextRequest, { params }: { params: Promise<{ warehouseId: string; date: string }> }) {
  const p = await params; return withApi(request, p.warehouseId, async () => ({ ok: true, containers: await readWorkday(p.warehouseId, p.date) }));
}
