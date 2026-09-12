import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
describe("IAP authorization boundary", () => { it("does not trust client role or warehouse headers", () => { const source = readFileSync(new URL("./auth.ts", import.meta.url), "utf8"); expect(source).not.toContain("x-inspection-role"); expect(source).not.toContain("x-inspection-warehouses"); expect(source).toContain("lookupMembership"); }); });
