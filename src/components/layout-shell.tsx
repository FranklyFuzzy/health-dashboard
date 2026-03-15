"use client";

import { useState, useCallback, useEffect } from "react";
import { mutate } from "swr";
import dynamic from "next/dynamic";
import { Sidebar } from "./sidebar";

const DashboardView = dynamic(() => import("./dashboard-view").then((m) => ({ default: m.DashboardView })));
const LogView = dynamic(() => import("./log-view").then((m) => ({ default: m.LogView })));
const SettingsView = dynamic(() => import("./settings-view").then((m) => ({ default: m.SettingsView })));
const BloodworkView = dynamic(() => import("./bloodwork-view").then((m) => ({ default: m.BloodworkView })));
const RawView = dynamic(() => import("./raw-view").then((m) => ({ default: m.RawView })));

const VIEW_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  log: "Daily Log",
  bloodwork: "Blood Work",
  raw: "Raw Data",
  settings: "Settings",
};

const VALID_VIEWS = new Set<string>(Object.keys(VIEW_TITLES));

function parseHash(): string {
  if (typeof window === "undefined") return "dashboard";
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (VALID_VIEWS.has(raw)) return raw;
  return "dashboard";
}

export function LayoutShell() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setCurrentView(parseHash());
    const onHash = () => setCurrentView(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = useCallback((view: string) => {
    setCurrentView(view);
    window.location.hash = view;
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await fetch("/api/sync-all", { method: "POST" });
      // Revalidate all SWR caches so dashboard updates
      mutate(() => true);
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar currentView={currentView} onViewChange={navigate} onSync={handleSync} syncing={syncing} />
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "#0a0a0a" }}>
        <header className="flex items-center border-b shrink-0" style={{ padding: "1rem 1.5rem", borderColor: "#1a1a1a" }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>{VIEW_TITLES[currentView] || "Dashboard"}</h1>
        </header>
        <main className="flex-1 overflow-y-auto" style={{ padding: "1.25rem" }}>
          {currentView === "dashboard" ? <DashboardView /> : null}
          {currentView === "log" ? <LogView /> : null}
          {currentView === "bloodwork" ? <BloodworkView /> : null}
          {currentView === "raw" ? <RawView /> : null}
          {currentView === "settings" ? <SettingsView /> : null}
        </main>
      </div>
    </div>
  );
}
