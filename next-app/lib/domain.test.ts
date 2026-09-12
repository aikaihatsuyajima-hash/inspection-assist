import { describe, expect, it } from "vitest";
import { allMetrics, canComplete, containerMetrics, scanDecision, statusFor } from "./domain";
import { BASELINE, cloneSeed } from "./seed";
describe("inspection domain", () => {
  it("keeps the PDF baseline", () => { const containers = cloneSeed(); const state = { containers, unknownCount: 0, activity: [] }; expect(containers).toHaveLength(BASELINE.containers); expect(containers.reduce((n, c) => n + c.items.length, 0)).toBe(BASELINE.items); expect(allMetrics(state).expected).toBe(BASELINE.expected); });
  it("classifies pending, exact and over", () => { const item = { id: "i", barcode: "1", name: "x", expected: 2, actual: 0 }; expect(statusFor(item).key).toBe("pending"); item.actual = 2; expect(statusFor(item).key).toBe("done"); item.actual = 3; expect(statusFor(item).key).toBe("over"); });
  it("does not complete with mismatch or unsynced work", () => { const c = cloneSeed()[0]; expect(canComplete(c, 0)).toBe(false); c.items[0].actual = 1; expect(canComplete(c, 1)).toBe(false); expect(canComplete(c, 0)).toBe(true); });
  it("calculates credited quantity without rewarding overage", () => { const c = cloneSeed()[0]; c.items[0].actual = 3; expect(containerMetrics(c).credited).toBe(1); expect(containerMetrics(c).percent).toBe(100); });
  it("distinguishes partial, exact, unknown, unselected, and completed scans", () => { const c = cloneSeed()[0]; const barcode = c.items[0].barcode; expect(scanDecision(c, barcode.slice(0, -1)).kind).toBe("unknown"); expect(scanDecision(c, barcode).kind).toBe("known"); expect(scanDecision(c, "9999999999999").kind).toBe("unknown"); expect(scanDecision(undefined, barcode).kind).toBe("ignored"); c.completed = true; expect(scanDecision(c, barcode).kind).toBe("ignored"); });
});
