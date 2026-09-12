import type { Container, ContainerItem, ItemStatus, InspectionState } from "./types";

export const containerMetrics = (container: Container) => {
  const expected = container.items.reduce((sum, item) => sum + item.expected, 0);
  const actual = container.items.reduce((sum, item) => sum + item.actual, 0);
  const credited = container.items.reduce((sum, item) => sum + Math.min(item.actual, item.expected), 0);
  const differences = container.items.filter((item) => item.actual > item.expected).length;
  return { expected, actual, credited, differences, percent: expected ? Math.round((credited / expected) * 100) : 0 };
};
export const allMetrics = (state: InspectionState) => state.containers.reduce((total, c) => { const m = containerMetrics(c); total.expected += m.expected; total.actual += m.actual; total.differences += m.differences + c.unknownCount + c.unresolvedDifferenceCount; return total; }, { expected: 0, actual: 0, differences: state.unknownCount || 0 });
export const statusFor = (item: ContainerItem): { key: ItemStatus; label: string } => item.actual === 0 ? { key: "pending", label: "未検品" } : item.actual < item.expected ? { key: "progress", label: "検品中" } : item.actual === item.expected ? { key: "done", label: "適正" } : { key: "over", label: "過剰" };
export const canComplete = (container: Container, unsynced = 0) => !container.completed && unsynced === 0 && container.unknownCount === 0 && container.unresolvedDifferenceCount === 0 && container.items.every((item) => item.actual === item.expected);
export const findItem = (container: Container, barcode: string) => container.items.find((item) => item.barcode === barcode.trim());
export const scanDecision = (container: Container | undefined, barcode: string) => {
  const value = barcode.trim();
  if (!container || container.completed || !value) return { kind: "ignored" as const, item: undefined };
  const item = findItem(container, value);
  return item ? { kind: "known" as const, item } : { kind: "unknown" as const, item: undefined };
};
