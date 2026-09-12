import { describe, expect, it } from "vitest";
import { cloneSeed } from "./seed";
import { validateLegacySnapshot } from "./legacy";

describe("legacy snapshot validation", () => {
  it("accepts the known 8/119/241 baseline", () => {
    expect(validateLegacySnapshot({ containers: cloneSeed(), activity: [], unknownCount: 0 }).containers).toHaveLength(8);
  });

  it("rejects a structurally incomplete snapshot", () => {
    expect(() => validateLegacySnapshot({ containers: cloneSeed().slice(0, 1) })).toThrow(/exactly 8/);
  });
});
