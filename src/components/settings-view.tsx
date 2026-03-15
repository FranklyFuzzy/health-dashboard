"use client";

import { useState, useCallback } from "react";
import { useSyncStatus } from "@/lib/hooks/use-health-data";

export function SettingsView() {
  const { data: status, mutate } = useSyncStatus();
  const [syncingOura, setSyncingOura] = useState(false);
  const [syncingChrono, setSyncingChrono] = useState(false);
  const [syncingLadder, setSyncingLadder] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const connectOura = useCallback(() => {
    window.location.href = "/api/oura-auth";
  }, []);

  const syncOura = useCallback(async () => {
    setSyncingOura(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync-oura", { method: "POST" });
      const data = await res.json();
      setResult(data.error ? `Oura: ${data.error}` : "Oura synced");
      mutate();
    } catch {
      setResult("Oura sync failed");
    } finally {
      setSyncingOura(false);
    }
  }, [mutate]);

  const syncChrono = useCallback(async () => {
    setSyncingChrono(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync-chrono", { method: "POST" });
      const data = await res.json();
      setResult(data.error ? `Chrono: ${data.error}` : `Chronometer synced${data.data?.water_oz != null ? ` (${data.data.water_oz}oz water)` : ""}`);
    } catch {
      setResult("Chronometer sync failed");
    } finally {
      setSyncingChrono(false);
    }
  }, []);

  const syncLadder = useCallback(async () => {
    setSyncingLadder(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync-ladder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "scan" }) });
      const data = await res.json();
      if (data.error) {
        setResult(`Ladder: ${data.error}`);
      } else {
        const msg = data.processed?.length
          ? `Ladder: ${data.processed.length} workout${data.processed.length > 1 ? "s" : ""} synced`
          : "Ladder: no new screenshots";
        setResult(data.errors?.length ? `${msg} (${data.errors.length} errors)` : msg);
      }
    } catch {
      setResult("Ladder sync failed");
    } finally {
      setSyncingLadder(false);
    }
  }, []);

  const reprocessLadder = useCallback(async () => {
    setSyncingLadder(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync-ladder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "rescan" }) });
      const data = await res.json();
      if (data.error) {
        setResult(`Ladder: ${data.error}`);
      } else {
        const msg = data.processed?.length
          ? `Ladder: reprocessed ${data.processed.length} workout${data.processed.length > 1 ? "s" : ""}`
          : "Ladder: no screenshots found";
        setResult(data.errors?.length ? `${msg} (${data.errors.length} errors)` : msg);
      }
    } catch {
      setResult("Ladder rescan failed");
    } finally {
      setSyncingLadder(false);
    }
  }, []);

  return (
    <div style={{ maxWidth: 480 }} className="space-y-6">
      {result && (
        <div
          className="rounded-lg px-3 py-2 text-[12px]"
          style={{
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border-color)",
            color: "var(--text-secondary)",
          }}
        >
          {result}
        </div>
      )}

      {/* Oura */}
      <Section title="Oura Ring">
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: status?.oura_connected ? "var(--positive)" : "var(--negative)" }}
          />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {status?.oura_connected ? "Connected" : "Not connected"}
          </span>
        </div>
        <div className="flex gap-2 mt-3">
          <SettingsButton onClick={connectOura}>
            {status?.oura_connected ? "Reconnect" : "Connect Oura"}
          </SettingsButton>
          {status?.oura_connected && (
            <SettingsButton onClick={syncOura} disabled={syncingOura}>
              {syncingOura ? "Syncing..." : "Sync Now"}
            </SettingsButton>
          )}
        </div>
        {status?.last_oura_sync && (
          <div className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Last sync: {status.last_oura_sync}
          </div>
        )}
      </Section>

      {/* Chronometer */}
      <Section title="Chronometer">
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
          Syncs food calories, macros, and water intake
        </div>
        <div className="flex gap-2">
          <SettingsButton onClick={syncChrono} disabled={syncingChrono}>
            {syncingChrono ? "Scraping..." : "Sync Now"}
          </SettingsButton>
        </div>
        {status?.last_chrono_sync && (
          <div className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Last sync: {status.last_chrono_sync}
          </div>
        )}
      </Section>

      {/* Ladder */}
      <Section title="Ladder">
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
          Scans workout screenshots from iCloud &rarr; Workout Pics folder.
          {process.env.NEXT_PUBLIC_GEMINI_CONFIGURED === "1"
            ? <span style={{ color: "var(--accent)", marginLeft: 6 }}>Using Gemini Vision</span>
            : <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>Using Tesseract OCR (add GEMINI_API_KEY to .env for better results)</span>
          }
        </div>
        <div className="flex gap-2">
          <SettingsButton onClick={syncLadder} disabled={syncingLadder}>
            {syncingLadder ? "Scanning..." : "Sync New"}
          </SettingsButton>
          <SettingsButton onClick={reprocessLadder} disabled={syncingLadder}>
            Reprocess All
          </SettingsButton>
        </div>
        {status?.last_ladder_sync && (
          <div className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Last sync: {status.last_ladder_sync}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}
    >
      <div className="text-[10px] uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>{title}</div>
      {children}
    </div>
  );
}

function SettingsButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "var(--bg-tertiary)",
        border: "1px solid var(--border-color)",
        color: "var(--text-secondary)",
        fontSize: 12,
        fontFamily: "inherit",
        padding: "0.4rem 0.8rem",
        borderRadius: 4,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
