"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useInspection } from "./InspectionProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { pending, sync } = useInspection();
  return <><header><Link className="brand" href="/">◇ 検品アシスト</Link><nav aria-label="メインナビゲーション"><Link className={pathname === "/" ? "active" : ""} href="/">概要</Link><Link className={pathname.startsWith("/inspection") ? "active" : ""} href="/inspection">検品作業</Link></nav><div className="header-meta"><span className={pending ? "offline-dot" : "online-dot"} />{pending ? `未同期 ${pending}件` : "オンライン"}<button onClick={() => void sync()}>同期</button></div></header>{children}</>;
}
