import { STORAGE_KEY, cloneSeed } from "./seed";
import type { InspectionState } from "./types";
export function exportLegacySnapshot(storage: Storage = window.localStorage): string { const value = storage.getItem(STORAGE_KEY); if (!value) throw new Error("旧版の保存データが見つかりません"); const parsed = JSON.parse(value) as InspectionState; return JSON.stringify({ schema: "inspection-assist-state-v5", exportedAt: new Date().toISOString(), snapshot: parsed }); }
export function validateLegacySnapshot(value: unknown): InspectionState {
  const snapshot = value as Partial<InspectionState> | null;
  if (!snapshot || !Array.isArray(snapshot.containers) || snapshot.containers.length !== 8) throw new Error("legacy snapshot must contain exactly 8 containers");
  let itemCount = 0; let expected = 0;
  for (const container of snapshot.containers) {
    if (!container || typeof container !== "object" || typeof container.id !== "string" || !Array.isArray(container.items)) throw new Error("legacy snapshot contains an invalid container");
    for (const item of container.items) {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || typeof item.barcode !== "string" || typeof item.name !== "string" || !Number.isInteger(item.expected) || item.expected < 0 || !Number.isInteger(item.actual) || item.actual < 0) throw new Error("legacy snapshot contains an invalid item");
      itemCount += 1; expected += item.expected;
    }
  }
  if (itemCount !== 119 || expected !== 241) throw new Error(`legacy snapshot baseline mismatch (items=${itemCount}, expected=${expected})`);
  return snapshot as InspectionState;
}
export function parseLegacySnapshot(raw: string) { const parsed = JSON.parse(raw) as { schema?: string; snapshot?: InspectionState }; if (parsed.schema !== "inspection-assist-state-v5") throw new Error("inspection-assist-state-v5のJSONではありません"); return validateLegacySnapshot(parsed.snapshot); }
export function freshState(): InspectionState { return { containers: cloneSeed(), activity: [], unknownCount: 0 }; }
