"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { allMetrics, canComplete, findItem } from "../lib/domain";
import { cloneSeed } from "../lib/seed";
import { countPending, enqueue, flushOutbox } from "../lib/outbox";
import { exportLegacySnapshot, freshState } from "../lib/legacy";
import type { Activity, Container, InspectionState } from "../lib/types";

const warehouse = process.env.NEXT_PUBLIC_WAREHOUSE_ID ?? "demo";
const TOKYO = "Asia/Tokyo";
export const workDate = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TOKYO, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
};
const key = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const readSelectedStorage = () => { try { return window.sessionStorage?.getItem("inspection-selected-container") ?? null; } catch { return null; } };
const writeSelectedStorage = (id: string) => { try { window.sessionStorage?.setItem("inspection-selected-container", id); } catch { /* query string remains the fallback */ } };

type ContextValue = {
  state: InspectionState;
  containers: Container[];
  selectedId: string | null;
  active: Container | undefined;
  pending: number;
  message: string;
  totals: ReturnType<typeof allMetrics>;
  selectContainer: (id: string) => void;
  scan: (value?: string, automatic?: boolean) => void;
  adjust: (itemId: string, delta: number) => void;
  complete: () => void;
  reopen: () => void;
  sync: () => Promise<void>;
  reset: () => void;
  exportData: () => void;
  barcodeInputRef: React.RefObject<HTMLInputElement | null>;
  setMessage: (value: string) => void;
};
const InspectionContext = createContext<ContextValue | null>(null);

export function InspectionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InspectionState>(freshState());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const latestOperation = useRef(new Map<string, number>());
  const autoSubmitted = useRef<{ value: string; at: number } | null>(null);

  const loadServer = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/warehouses/${warehouse}/workdays/${workDate()}/containers`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { containers?: Container[] };
      if (Array.isArray(data.containers)) setState((current) => ({ ...current, containers: data.containers as Container[] }));
    } catch { /* keep the last snapshot while offline */ }
  }, []);

  useEffect(() => {
    const queryId = searchParams.get("container");
    const stored = readSelectedStorage();
    const candidate = queryId || stored;
    if (!candidate || selectedId === candidate || !state.containers.some((container) => container.id === candidate)) return;
    const timer = window.setTimeout(() => setSelectedId(candidate), 0);
    return () => window.clearTimeout(timer);
  }, [pathname, searchParams, selectedId, state.containers]);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadServer(), 0);
    const refresh = window.setInterval(() => { void loadServer(); if (navigator.onLine) void flushOutbox().then(() => countPending().then(setPending)); }, 15000);
    const online = () => void flushOutbox().then(() => countPending().then(setPending));
    window.addEventListener("online", online);
    void countPending().then(setPending).catch(() => undefined);
    return () => { window.clearTimeout(initial); window.clearInterval(refresh); window.removeEventListener("online", online); };
  }, [loadServer]);

  // Query is the immediate source of truth during client navigation; state/session
  // hydration follows asynchronously and may not have committed yet.
  const effectiveSelectedId = selectedId ?? searchParams.get("container");
  const selected = state.containers.find((container) => container.id === effectiveSelectedId);
  const totals = useMemo(() => allMetrics(state), [state]);

  const addActivity = useCallback((activity: Activity) => {
    setState((current) => ({ ...current, activity: [activity, ...current.activity].slice(0, 30) }));
  }, []);

  const change = useCallback(async (
    container: Container,
    body: unknown,
    optimistic: (next: Container) => void,
    inverse: (current: Container) => void,
    url: string,
    activity?: Activity,
  ) => {
    const operation = (latestOperation.current.get(container.id) ?? 0) + 1;
    latestOperation.current.set(container.id, operation);
    // Build the optimistic value from the latest state, not the closure snapshot.
    // Scanner events can arrive before the previous render has completed.
    setState((current) => ({ ...current, containers: current.containers.map((item) => {
      if (item.id !== container.id) return item;
      const next = structuredClone(item);
      optimistic(next);
      return next;
    }) }));
    if (activity) addActivity(activity);
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (response.ok) {
        const result = await response.json() as { container?: Container };
        // A later optimistic operation owns the visible state; its response must not clobber it.
        if (result.container && latestOperation.current.get(container.id) === operation) setState((current) => ({ ...current, containers: current.containers.map((item) => item.id === container.id ? result.container as Container : item) }));
        return;
      }
      setState((current) => ({ ...current, containers: current.containers.map((item) => {
        if (item.id !== container.id) return item;
        const reverted = structuredClone(item);
        inverse(reverted);
        return reverted;
      }) }));
      setMessage(response.status >= 500 ? "サーバーエラーのため、この操作だけを取り消しました" : "サーバーがこの操作を拒否しました");
    } catch {
      await enqueue({ url, body, method: "POST" });
      setPending(await countPending());
      setMessage("未同期キューに保存しました（オンライン復旧後に再送）");
    }
  }, [addActivity]);

  const selectContainer = useCallback((id: string) => {
    if (!state.containers.some((container) => container.id === id)) { setMessage("登録されていないオリコンです"); return; }
    setSelectedId(id);
    writeSelectedStorage(id);
    router.push(`/inspection?container=${encodeURIComponent(id)}`);
  }, [router, state.containers]);

  const scan = useCallback((input?: string, automatic = false) => {
    const value = (input ?? "").trim();
    const active = state.containers.find((container) => container.id === effectiveSelectedId);
    if (!active || active.completed || !value) return;
    const recent = autoSubmitted.current;
    if (recent && recent.value === value && Date.now() - recent.at < 800) return;
    autoSubmitted.current = automatic ? { value, at: Date.now() } : null;
    const item = findItem(active, value);
    const body = { idempotencyKey: key(), barcode: value, quantity: 1, deviceId: "browser" };
    const url = `/api/v1/warehouses/${warehouse}/workdays/${workDate()}/containers/${active.id}/scans`;
    setMessage(item ? `${item.name} を登録しました` : "このオリコンの対象外商品です。品違いとして記録しました");
    if (item) {
      void change(active, body, (next) => { const target = next.items.find((candidate) => candidate.id === item.id); if (target) target.actual += 1; }, (current) => { const target = current.items.find((candidate) => candidate.id === item.id); if (target) target.actual = Math.max(0, target.actual - 1); }, url, { type: "ok", name: item.name, detail: "バーコード読取・1点", time: new Date().toISOString(), eventId: body.idempotencyKey });
    } else {
      void change(active, body, (next) => { next.unknownCount += 1; next.unresolvedDifferenceCount += 1; }, (current) => { current.unknownCount = Math.max(0, current.unknownCount - 1); current.unresolvedDifferenceCount = Math.max(0, current.unresolvedDifferenceCount - 1); }, url, { type: "error", name: "対象外商品", detail: `${value} を品違いとして記録`, time: new Date().toISOString(), eventId: body.idempotencyKey });
    }
    window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
  }, [change, effectiveSelectedId, state.containers]);

  const adjust = useCallback((itemId: string, delta: number) => {
    const active = state.containers.find((container) => container.id === effectiveSelectedId);
    if (!active || active.completed) return;
    const body = { idempotencyKey: key(), itemId, delta, deviceId: "browser" };
    const url = `/api/v1/warehouses/${warehouse}/workdays/${workDate()}/containers/${active.id}/adjustments`;
    void change(active, body, (next) => { const item = next.items.find((candidate) => candidate.id === itemId); if (item) item.actual = Math.max(0, item.actual + delta); }, (current) => { const item = current.items.find((candidate) => candidate.id === itemId); if (item) item.actual = Math.max(0, item.actual - delta); }, url, { type: "warn", name: "数量補正", detail: `${delta > 0 ? "+" : ""}${delta}点`, time: new Date().toISOString(), eventId: body.idempotencyKey });
  }, [change, effectiveSelectedId, state.containers]);

  const complete = useCallback(() => {
    const active = state.containers.find((container) => container.id === effectiveSelectedId);
    if (!active || !canComplete(active, pending)) return;
    const body = { idempotencyKey: key(), unsynced: pending };
    const url = `/api/v1/warehouses/${warehouse}/workdays/${workDate()}/containers/${active.id}/complete`;
    void change(active, body, (next) => { next.completed = true; }, (current) => { current.completed = false; }, url);
  }, [change, effectiveSelectedId, pending, state.containers]);

  const reopen = useCallback(() => {
    const active = state.containers.find((container) => container.id === effectiveSelectedId);
    if (!active?.completed) return;
    const body = { idempotencyKey: key() };
    const url = `/api/v1/warehouses/${warehouse}/workdays/${workDate()}/containers/${active.id}/reopen`;
    void change(active, body, (next) => { next.completed = false; }, (current) => { current.completed = true; }, url);
  }, [change, effectiveSelectedId, state.containers]);

  const sync = useCallback(async () => {
    const result = await flushOutbox().catch(() => ({ sent: 0, blocked: true }));
    const count = await countPending().catch(() => pending);
    setPending(count);
    if (result.sent) void loadServer();
    setMessage(result.sent ? `${result.sent}件を同期しました` : count ? "未同期データを送信できません。要確認です" : "同期対象はありません");
  }, [loadServer, pending]);

  const exportData = useCallback(() => {
    try { const blob = new Blob([exportLegacySnapshot()], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `inspection-assist-${workDate()}.json`; link.click(); URL.revokeObjectURL(link.href); } catch { setMessage("旧版データがありません"); }
  }, []);
  const reset = useCallback(() => { if (window.confirm("すべての検品データと履歴をリセットしますか？")) { setState({ ...freshState(), containers: cloneSeed() }); setSelectedId(null); try { window.sessionStorage?.removeItem("inspection-selected-container"); } catch { /* optional browser storage */ } } }, []);

  return <InspectionContext.Provider value={{ state, containers: state.containers, selectedId: effectiveSelectedId, active: selected, pending, message, totals, selectContainer, scan, adjust, complete, reopen, sync, reset, exportData, barcodeInputRef, setMessage }}>{children}</InspectionContext.Provider>;
}
export function useInspection() { const value = useContext(InspectionContext); if (!value) throw new Error("useInspection must be used within InspectionProvider"); return value; }
