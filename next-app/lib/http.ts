import { NextResponse } from "next/server";
import { AuthError, requirePrincipal } from "./auth";
import type { Principal } from "./types";
import { RepositoryError } from "./firestore";
import type { NextRequest } from "next/server";
import { validatePath } from "./validation";
export async function withApi<T>(request: NextRequest, warehouseId: string, handler: (actor: string, principal: Principal) => Promise<T>, allowedStatus = 200) {
  try { validatePath(warehouseId); const principal = await requirePrincipal(request, warehouseId); const data = await handler(principal.subject, principal); return NextResponse.json(data, { status: allowedStatus }); }
  catch (error) { const status = error instanceof AuthError || error instanceof RepositoryError ? error.status : 500; return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, { status }); }
}
export const jsonBody = async <T>(request: NextRequest) => { try { return await request.json() as T; } catch { throw new RepositoryError("Invalid JSON body", 400); } };
