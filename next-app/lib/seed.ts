import type { Container } from "./types";

const definitions = [
  ["10563560", "サンプル得意先A", "東京・午前便", "品番少・数量少", 1, [1]],
  ["10565288", "サンプル得意先A", "東京・午前便", "品番少・数量少", 2, [1, 1]],
  ["10564568", "サンプル得意先A", "東京・午後便", "品番多・数量多", 30, [2,3,2,4,2,3,2,4,3,2,3,2,4,2,3,2,3,2,4,3,2,3,2,4,2,3,2,4,3,2]],
  ["10564280", "サンプル得意先B", "埼玉便", "品番多・数量多", 27, [3,2,4,2,3,2,4,3,2,3,2,4,2,3,2,4,3,2,3,2,4,3,2,3,2,4,3]],
  ["10565365", "サンプル得意先B", "千葉便", "品番多い", 29, []],
  ["10564462", "サンプル得意先C", "神奈川便", "品番多い", 27, []],
  ["10564208", "サンプル得意先C", "神奈川便", "数量多い", 2, [8, 6]],
  ["10565081", "サンプル得意先C", "神奈川便", "数量多い", 1, [10]]
] as const;

const known = ["4310145658032", "4232349728413", "4107393407617", "4962269408866", "4390988375846", "4417827296923", "4348543972023", "4788070113566", "4273845449907"];
const barcode = (containerIndex: number, itemIndex: number) => known[containerIndex === 0 ? itemIndex : -1] ?? `490${containerIndex + 1}${String(itemIndex + 1).padStart(10, "0")}`;

export const SOURCE_CONTAINERS: Container[] = definitions.map(([id, customer, route, pattern, count, quantities], containerIndex) => ({
  id, customer, route, pattern,
  items: Array.from({ length: count }, (_, itemIndex) => ({
    id: `TEST-${String(containerIndex + 1).padStart(2, "0")}-${String(itemIndex + 1).padStart(3, "0")}`,
    barcode: barcode(containerIndex, itemIndex),
    name: `検証商品 ${String(itemIndex + 1).padStart(3, "0")}`,
    expected: quantities[itemIndex] ?? 1,
    actual: 0
  })),
  completed: false, revision: 0, unknownCount: 0, unresolvedDifferenceCount: 0
}));

export const STORAGE_KEY = "inspection-assist-state-v5";
export const cloneSeed = (): Container[] => structuredClone(SOURCE_CONTAINERS);
export const BASELINE = { containers: 8, items: 119, expected: 241 } as const;
