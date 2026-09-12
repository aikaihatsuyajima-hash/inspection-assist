import { describe, expect, it } from "vitest";
import { canonical, digest } from "./canonical";
import { parseScan, validatePath } from "./validation";
import { cloneSeed } from "./seed";
import { canComplete } from "./domain";
describe("validation and security boundaries", () => {
  it("canonical digest ignores object key order", () => { expect(digest({ b: 2, a: 1 })).toBe(digest({ a: 1, b: 2 })); expect(canonical({ a: 1 })).toBe('{"a":1}'); });
  it("rejects invalid scan and path values", () => { expect(() => parseScan({ idempotencyKey: "x", barcode: "abc" })).toThrow(); expect(() => parseScan({ idempotencyKey: "bad/key", barcode: "1" })).toThrow(); expect(() => validatePath("bad path", "2026-01-01", "1")).toThrow(); expect(() => validatePath("w", "2026/01/01", "1")).toThrow(); });
  it("keeps unknown differences blocking completion", () => { const c = cloneSeed()[0]; c.items[0].actual = c.items[0].expected; c.unknownCount = 1; c.unresolvedDifferenceCount = 1; expect(canComplete(c, 0)).toBe(false); });
});
