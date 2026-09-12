/*
 * Run in the old inspection-assist origin's DevTools console, then save the
 * printed JSON. It intentionally exports the opaque legacy snapshot as-is;
 * it does not invent operator or historical audit information.
 */
(function exportInspectionAssistSnapshot() {
  const key = "inspection-assist-state-v5";
  const raw = window.localStorage.getItem(key);
  if (!raw) throw new Error(`${key} が見つかりません`);
  const snapshot = JSON.parse(raw);
  if (!snapshot || !Array.isArray(snapshot.containers) || snapshot.containers.length !== 8) throw new Error("8オリコンのlegacy snapshotではありません");
  const output = JSON.stringify({ schema: key, exportedAt: new Date().toISOString(), snapshot });
  copy(output);
  console.log("検品アシスト移行用JSONをクリップボードへコピーしました", { containers: snapshot.containers.length, items: snapshot.containers.reduce((n, c) => n + c.items.length, 0) });
  return output;
}());
