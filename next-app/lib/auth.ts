import { createRemoteJWKSet, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import type { Principal, Role } from "./types";
import { lookupMembership } from "./firestore";

const roles: Role[] = ["operator", "manager", "admin"];
export async function requirePrincipal(request: NextRequest, warehouseId: string): Promise<Principal> {
  const bypass = process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS === "true";
  if (bypass) return { subject: "local-dev", email: "local@example.invalid", role: "admin", warehouseIds: [warehouseId] };
  const token = request.headers.get("x-goog-iap-jwt-assertion");
  if (!token) throw new AuthError("IAP JWT is required", 401);
  const audience = process.env.IAP_AUDIENCE;
  const issuer = process.env.IAP_ISSUER ?? "https://cloud.google.com/iap";
  if (!audience) throw new AuthError("IAP audience is not configured", 503);
  try {
    const jwks = createRemoteJWKSet(new URL("https://www.gstatic.com/iap/verify/public_key-jwk"));
    const { payload } = await jwtVerify(token, jwks, { audience, issuer });
    const email = typeof payload.email === "string" ? payload.email : ""; const subject = String(payload.sub ?? email);
    if (!email || !subject) throw new AuthError("Invalid principal", 403);
    const membership = await lookupMembership(subject, email, warehouseId);
    if (!membership || !roles.includes(membership.role)) throw new AuthError("Warehouse membership denied", 403);
    return { subject, email, role: membership.role, warehouseIds: membership.warehouseIds };
  } catch (error) { if (error instanceof AuthError) throw error; throw new AuthError("Invalid IAP JWT", 401); }
}
export class AuthError extends Error { constructor(message: string, public status: number) { super(message); } }
export function assertRole(principal: Principal, allowed: Role[]) { if (!allowed.includes(principal.role)) throw new AuthError("Role not permitted", 403); }
