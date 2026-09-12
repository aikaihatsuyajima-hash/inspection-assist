import type { Metadata } from "next";
import "./globals.css";
import AppShell from "../components/AppShell";
import { InspectionProvider } from "../components/InspectionProvider";
import { Suspense } from "react";
export const metadata: Metadata = { title: "検品アシスト", description: "出荷検品アシスト" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ja"><body><Suspense fallback={<div>読み込み中…</div>}><InspectionProvider><AppShell>{children}</AppShell></InspectionProvider></Suspense></body></html>; }
