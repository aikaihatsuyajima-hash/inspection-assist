import { describe, expect, it } from "vitest";
import { shouldRemoveAfterResponse } from "./outbox";
describe("outbox response policy", () => { it("removes only 2xx responses", () => { expect(shouldRemoveAfterResponse(200)).toBe(true); expect(shouldRemoveAfterResponse(204)).toBe(true); expect(shouldRemoveAfterResponse(400)).toBe(false); expect(shouldRemoveAfterResponse(401)).toBe(false); expect(shouldRemoveAfterResponse(409)).toBe(false); expect(shouldRemoveAfterResponse(503)).toBe(false); }); });
