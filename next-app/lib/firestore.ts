import { Firestore, FieldValue } from "@google-cloud/firestore";
import { cloneSeed } from "./seed";
import type { AdjustmentCommand, ApiResult, Container, ScanCommand } from "./types";
import { digest } from "./canonical";
import { validateLegacySnapshot } from "./legacy";

export type Event = { eventId: string; kind: string; actor: string; warehouseId: string; idempotencyKey: string; payload: unknown; createdAt: string };
const firestore = new Firestore();
// Memory mode is deliberately opt-in and unavailable in production. It enables
// local route/UI verification without accidentally turning a deployed service
// into an in-memory data store.
const memoryMode = process.env.NODE_ENV !== "production" && process.env.DATA_BACKEND === "memory";
const memoryContainers = new Map<string, Container>();
const memoryEvents = new Map<string, ApiResult & { payloadDigest: string }>();
const memoryImportRuns = new Map<string, { runId: string; mode: string; payloadDigest: string; status: string }>();
const memoryKey = (warehouseId: string, date: string, containerNo: string) => `${warehouseId}/${date}/${containerNo}`;
const memoryEventKey = (warehouseId: string, idempotencyKey: string) => `${warehouseId}/${idempotencyKey}`;
const ref = (warehouseId: string, date: string, containerNo: string) => firestore.doc(`warehouses/${warehouseId}/workdays/${date}/containers/${containerNo}`);
const normalize = (value: Container): Container => ({ ...value, revision: value.revision ?? 0, unknownCount: value.unknownCount ?? 0, unresolvedDifferenceCount: value.unresolvedDifferenceCount ?? 0 });
export async function lookupMembership(subject: string, email: string, warehouseId: string) {
  const principal = await firestore.doc(`principals/${subject}`).get();
  const member = await firestore.doc(`warehouses/${warehouseId}/members/${subject}`).get();
  const data = member.exists ? member.data() : principal.exists ? principal.data() : undefined;
  if (!data || typeof data.role !== "string") return null;
  const role = data.role as "operator" | "manager" | "admin";
  const warehouseIds = Array.isArray(data.warehouseIds) ? data.warehouseIds.filter((id): id is string => typeof id === "string") : [warehouseId];
  if (!warehouseIds.includes(warehouseId)) return null;
  return { subject, email: typeof data.email === "string" ? data.email : email, role, warehouseIds };
}

export async function ensureWorkday(warehouseId: string, date: string) {
  if (memoryMode) return;
  const workday = firestore.doc(`warehouses/${warehouseId}/workdays/${date}`);
  const snapshot = await workday.get();
  if (!snapshot.exists) await workday.create({ date, status: "open", createdAt: FieldValue.serverTimestamp() });
}
export async function readContainer(warehouseId: string, date: string, containerNo: string): Promise<Container> {
  if (memoryMode) {
    const key = memoryKey(warehouseId, date, containerNo);
    const existing = memoryContainers.get(key);
    if (existing) return structuredClone(existing);
    const seed = cloneSeed().find((container) => container.id === containerNo);
    if (!seed) throw new RepositoryError("Container not found", 404);
    memoryContainers.set(key, structuredClone(seed));
    return structuredClone(seed);
  }
  const snapshot = await ref(warehouseId, date, containerNo).get();
  if (snapshot.exists) return normalize(snapshot.data() as Container);
  const seed = cloneSeed().find((container) => container.id === containerNo);
  if (!seed) throw new RepositoryError("Container not found", 404);
  await ref(warehouseId, date, containerNo).create({ ...seed, createdAt: FieldValue.serverTimestamp() });
  return seed;
}
export async function readWorkday(warehouseId: string, date: string): Promise<Container[]> {
  if (memoryMode) {
    return Promise.all(cloneSeed().map((container) => readContainer(warehouseId, date, container.id)));
  }
  await ensureWorkday(warehouseId, date);
  const snapshots = await firestore.collection(`warehouses/${warehouseId}/workdays/${date}/containers`).get();
  const byId = new Map(snapshots.docs.map((doc) => [doc.id, normalize(doc.data() as Container)]));
  const seed = cloneSeed();
  for (const item of seed) if (!byId.has(item.id)) { await ref(warehouseId, date, item.id).create({ ...item, createdAt: FieldValue.serverTimestamp() }); byId.set(item.id, item); }
  return seed.map((item) => byId.get(item.id) ?? item);
}
function eventRef(warehouseId: string, idempotencyKey: string) { return firestore.doc(`warehouses/${warehouseId}/inspectionEvents/${idempotencyKey}`); }
async function transactCommand(warehouseId: string, date: string, containerNo: string, idempotencyKey: string, kind: string, actor: string, payload: unknown, mutate: (container: Container) => { message: string; container: Container }) : Promise<ApiResult> {
  if (!/^[A-Za-z0-9._~-]{1,128}$/.test(idempotencyKey)) throw new RepositoryError("Invalid idempotency key", 400);
  if (memoryMode) {
    const eventKey = memoryEventKey(warehouseId, idempotencyKey);
    const previous = memoryEvents.get(eventKey);
    if (previous) {
      if (previous.payloadDigest !== digest(payload)) throw new RepositoryError("Idempotency key was used with a different payload", 409);
      return { ...previous, replayed: true };
    }
    const key = memoryKey(warehouseId, date, containerNo);
    const rawCurrent = memoryContainers.get(key) ?? cloneSeed().find((container) => container.id === containerNo);
    if (!rawCurrent) throw new RepositoryError("Container not found", 404);
    const current = normalize(structuredClone(rawCurrent));
    if (current.completed && kind !== "reopen") throw new RepositoryError("Completed container cannot be changed", 409);
    const changed = mutate(structuredClone(current));
    changed.container.revision = current.revision + 1;
    changed.container.unresolvedDifferenceCount = changed.container.unknownCount + changed.container.items.filter((item) => item.actual !== item.expected).length;
    const result = { ok: true, idempotencyKey, message: changed.message, container: changed.container, revision: changed.container.revision } satisfies ApiResult;
    memoryContainers.set(key, structuredClone(changed.container));
    memoryEvents.set(eventKey, { ...result, payloadDigest: digest(payload) });
    return result;
  }
  const result = await firestore.runTransaction(async (tx) => {
    const containerRef = ref(warehouseId, date, containerNo); const idemRef = eventRef(warehouseId, idempotencyKey); const workdayRef = firestore.doc(`warehouses/${warehouseId}/workdays/${date}`);
    const [containerSnap, idemSnap] = await Promise.all([tx.get(containerRef), tx.get(idemRef)]);
    if (idemSnap.exists) {
      const previous = idemSnap.data() as ApiResult & { payloadDigest?: string };
      if (previous.payloadDigest !== digest(payload)) throw new RepositoryError("Idempotency key was used with a different payload", 409);
      return { ...previous, replayed: true };
    }
    const rawCurrent = (containerSnap.exists ? containerSnap.data() : cloneSeed().find((c) => c.id === containerNo)) as Container | undefined;
    if (!rawCurrent) throw new RepositoryError("Container not found", 404);
    const current = normalize(rawCurrent);
    if (current.completed && kind !== "reopen") throw new RepositoryError("Completed container cannot be changed", 409);
    const before = structuredClone(current);
    const changed = mutate(structuredClone(current));
    changed.container.revision = current.revision + 1;
    changed.container.unresolvedDifferenceCount = changed.container.unknownCount + changed.container.items.filter((item) => item.actual !== item.expected).length;
    tx.set(containerRef, changed.container);
    tx.set(workdayRef, { hasInspectionEvents: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const result = { ok: true, idempotencyKey, message: changed.message, container: changed.container, revision: changed.container.revision };
    tx.create(idemRef, { ...result, payloadDigest: digest(payload), kind, actor, warehouseId, idempotencyKey, before, after: changed.container, result, createdAt: FieldValue.serverTimestamp() });
    return result;
  });
  return result;
}
export function recordScan(warehouseId: string, date: string, containerNo: string, command: ScanCommand, actor: string) {
  const barcode = command.barcode.trim();
  if (!barcode || barcode.length > 64 || !/^\d+$/.test(barcode)) throw new RepositoryError("Barcode must be numeric", 400);
  const quantity = command.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new RepositoryError("Quantity must be 1..100", 400);
  return transactCommand(warehouseId, date, containerNo, command.idempotencyKey, "scan", actor, command, (container) => {
    const item = container.items.find((candidate) => candidate.barcode === barcode);
    if (!item) { container.unknownCount += quantity; return { message: "wrong-item", container }; }
    item.actual += quantity;
    return { message: item.actual > item.expected ? "over" : "scanned", container };
  });
}
export function adjustItem(warehouseId: string, date: string, containerNo: string, command: AdjustmentCommand, actor: string) {
  if (!Number.isInteger(command.delta) || command.delta < -100 || command.delta > 100 || command.delta === 0) throw new RepositoryError("Delta must be a non-zero integer between -100 and 100", 400);
  return transactCommand(warehouseId, date, containerNo, command.idempotencyKey, "adjust", actor, command, (container) => {
    const item = container.items.find((candidate) => candidate.id === command.itemId); if (!item) throw new RepositoryError("Item not found", 404);
    item.actual = Math.max(0, item.actual + command.delta); return { message: "adjusted", container };
  });
}
export function completeContainer(warehouseId: string, date: string, containerNo: string, idempotencyKey: string, actor: string, unsynced = 0) {
  return transactCommand(warehouseId, date, containerNo, idempotencyKey, "complete", actor, { idempotencyKey, unsynced }, (container) => {
    if (unsynced > 0 || container.unknownCount > 0 || container.unresolvedDifferenceCount > 0 || container.items.some((item) => item.actual !== item.expected)) throw new RepositoryError("All items must be exact, differences resolved, and synchronized before completion", 422);
    container.completed = true; return { message: "completed", container };
  });
}
export function reopenContainer(warehouseId: string, date: string, containerNo: string, idempotencyKey: string, actor: string) {
  return transactCommand(warehouseId, date, containerNo, idempotencyKey, "reopen", actor, { idempotencyKey }, (container) => {
    if (!container.completed) throw new RepositoryError("Container is not completed", 409);
    container.completed = false;
    return { message: "reopened", container };
  });
}
export function resolveDifference(warehouseId: string, date: string, containerNo: string, idempotencyKey: string, actor: string, count = 1) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new RepositoryError("Difference count must be 1..100", 400);
  return transactCommand(warehouseId, date, containerNo, idempotencyKey, "resolve-difference", actor, { idempotencyKey, count }, (container) => {
    if (container.unknownCount < count) throw new RepositoryError("No unresolved difference to resolve", 409);
    container.unknownCount -= count;
    return { message: "difference-resolved", container };
  });
}
export async function writeImportRun(warehouseId: string, actor: string, payload: unknown, mode: "preview" | "apply" | "rollback") {
  const body = payload as { idempotencyKey?: unknown };
  if (typeof body?.idempotencyKey !== "string" || !/^[A-Za-z0-9._~-]{1,128}$/.test(body.idempotencyKey)) throw new RepositoryError("Import idempotencyKey is required and must be a safe token", 400);
  if (memoryMode) {
    const runKey = `${warehouseId}/${body.idempotencyKey}`;
    const existing = memoryImportRuns.get(runKey);
    if (existing) {
      if (existing.payloadDigest !== digest(payload)) throw new RepositoryError("Idempotency key was used with a different payload", 409);
      return { runId: existing.runId, mode: existing.mode, replayed: true };
    }
    if (mode !== "rollback") {
      try { validateLegacySnapshot((payload as { snapshot?: unknown }).snapshot); } catch (error) { throw new RepositoryError(error instanceof Error ? error.message : "Invalid legacy snapshot", 422); }
    } else {
      const targetId = (payload as { runId?: unknown }).runId;
      if (typeof targetId !== "string" || !memoryImportRuns.has(`${warehouseId}/${targetId}`)) throw new RepositoryError("Import run not found", 404);
    }
    const runId = body.idempotencyKey;
    memoryImportRuns.set(runKey, { runId, mode, payloadDigest: digest(payload), status: mode === "preview" ? "preview" : mode === "apply" ? "applied" : "rolled_back" });
    return { runId, mode, replayed: false };
  }
  const run = firestore.doc(`warehouses/${warehouseId}/importRuns/${body.idempotencyKey}`); const workdayRef = firestore.doc(`warehouses/${warehouseId}/workdays/${new Date().toISOString().slice(0, 10)}`);
  const audit = eventRef(warehouseId, `import-${body.idempotencyKey}`);
  return firestore.runTransaction(async (tx) => {
    const existing = await tx.get(run);
    if (existing.exists) {
      const old = existing.data() as { mode: string; payloadDigest: string; runId: string };
      if (old.payloadDigest !== digest(payload)) throw new RepositoryError("Idempotency key was used with a different payload", 409);
      return { runId: old.runId, mode: old.mode, replayed: true };
    }
    const runId = run.id;
    const snapshot = (payload as { snapshot?: unknown }).snapshot;
    if (mode !== "rollback") {
      try { validateLegacySnapshot(snapshot); } catch (error) { throw new RepositoryError(error instanceof Error ? error.message : "Invalid legacy snapshot", 422); }
    }
    if (mode === "rollback") {
      const targetId = (payload as { runId?: unknown }).runId;
      if (typeof targetId !== "string" || !targetId) throw new RepositoryError("runId is required for rollback", 400);
      const target = firestore.doc(`warehouses/${warehouseId}/importRuns/${targetId}`);
      const targetSnap = await tx.get(target); if (!targetSnap.exists) throw new RepositoryError("Import run not found", 404);
      const dataset = await tx.get(firestore.doc(`warehouses/${warehouseId}/datasets/${targetId}`)); const previousDatasetId = dataset.exists ? dataset.data()?.previousDatasetId ?? null : null;
      tx.set(workdayRef, { activeDatasetId: previousDatasetId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.update(target, { status: "rolled_back", rolledBackBy: actor, rolledBackAt: FieldValue.serverTimestamp() });
    } else if (mode === "apply") {
      const workday = await tx.get(workdayRef); if (workday.exists && workday.data()?.hasInspectionEvents) throw new RepositoryError("Import is locked after inspection events", 409);
      const previousDatasetId = workday.exists ? workday.data()?.activeDatasetId ?? null : null;
      tx.create(firestore.doc(`warehouses/${warehouseId}/datasets/${runId}`), { snapshot, source: "legacy-snapshot", createdBy: actor, previousDatasetId, createdAt: FieldValue.serverTimestamp() });
      tx.set(workdayRef, { activeDatasetId: runId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    tx.create(run, { runId, mode, actor, payload, payloadDigest: digest(payload), status: mode === "preview" ? "preview" : "applied", createdAt: FieldValue.serverTimestamp() });
    tx.create(audit, { eventId: audit.id, kind: `import-${mode}`, actor, warehouseId, idempotencyKey: body.idempotencyKey, payloadDigest: digest(payload), before: null, after: mode === "apply" ? { activeDatasetId: runId } : null, result: { runId, mode }, revision: 0, createdAt: FieldValue.serverTimestamp() });
    return { runId, mode, replayed: false };
  });
}
export class RepositoryError extends Error { constructor(message: string, public status: number) { super(message); } }
