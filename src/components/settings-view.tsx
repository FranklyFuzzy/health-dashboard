"use client";

import { useState, useCallback } from "react";
import { useSyncStatus } from "@/lib/hooks/use-health-data";

const DAYS_OPTIONS = [1, 3, 7] as const;

export function SettingsView() {
  const { data: status, mutate } = useSyncStatus();
  const [syncingGarmin, setSyncingGarmin] = useState(false);
  const [syncingChrono, setSyncingChrono] = useState(false);
  const [syncingLadder, setSyncingLadder] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [days, setDays] = useState<number>(1);

  const anySyncing = syncingGarmin || syncingChrono || syncingLadder || syncingAll;

  const syncAll = useCallback(async () => {
    setSyncingAll(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const data = await res.json();
      const parts: string[] = [];
      if (data.garmin?.error) parts.push(`Garmin: ${data.garmin.error}`);
      else if (data.garmin) parts.push("Garmin synced");
      if (data.chrono?.error) parts.push(`Cronometer: ${data.chrono.error}`);
      else if (data.chrono) parts.push("Cronometer synced");
      if (data.ladder?.error) parts.push(`Ladder: ${data.ladder.error}`);
      else if (data.ladder) parts.push("Ladder synced");
      setResult(parts.join(" · ") || "Sync complete");
      mutate();
    } catch {
      setResult("Sync All failed");
    } finally {
      setSyncingAll(false);
    }
  }, [days, mutate]);

  const syncGarmin = useCallback(async () => {
    setSyncingGarmin(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync-garmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const data = await res.json();
      setResult(data.error ? `Garmin: ${data.error}` : "Garmin synced");
      mutate();
    } catch {
      setResult("Garmin sync failed");
    } finally {
      setSyncingGarmin(false);
    }
  }, [days, mutate]);

  const syncChrono = useCallback(async () => {
    setSyncingChrono(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync-chrono", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const data = await res.json();
      setResult(data.error ? `Cronometer: ${data.error}` : "Cronometer synced");
    } catch {
      setResult("Cronometer sync failed");
    } finally {
      setSyncingChrono(false);
    }
  }, [days]);

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

      {/* Sync All */}
      <Section title="Sync All">
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
          Sync all data sources at once
        </div>
        <div className="flex items-center gap-3">
          <SettingsButton onClick={syncAll} disabled={anySyncing}>
            {syncingAll ? "Syncing..." : "Sync All"}
          </SettingsButton>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border-color)",
              color: "var(--text-secondary)",
              fontSize: 12,
              fontFamily: "inherit",
              padding: "0.4rem 0.5rem",
              borderRadius: 4,
            }}
          >
            {DAYS_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} day{d > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>
      </Section>

      {/* Garmin */}
      <Section title="Garmin Connect">
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: status?.garmin_configured ? "var(--positive)" : "var(--negative)" }}
          />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {status?.garmin_configured ? "Configured" : "Not configured — add GARMIN_EMAIL to .env"}
          </span>
        </div>
        <div className="flex gap-2 mt-3">
          <SettingsButton onClick={syncGarmin} disabled={anySyncing}>
            {syncingGarmin ? "Syncing..." : "Sync Now"}
          </SettingsButton>
        </div>
        {status?.last_garmin_sync && (
          <div className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Last sync: {status.last_garmin_sync}
          </div>
        )}
      </Section>

      {/* Cronometer */}
      <Section title="Cronometer">
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
          Syncs food calories and macros
        </div>
        <div className="flex gap-2">
          <SettingsButton onClick={syncChrono} disabled={anySyncing}>
            {syncingChrono ? "Syncing..." : "Sync Now"}
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
          <SettingsButton onClick={syncLadder} disabled={anySyncing}>
            {syncingLadder ? "Scanning..." : "Sync New"}
          </SettingsButton>
          <SettingsButton onClick={reprocessLadder} disabled={anySyncing}>
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
