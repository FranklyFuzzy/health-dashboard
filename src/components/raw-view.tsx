"use client";

import { useState, useCallback, useEffect } from "react";

interface RawLog {
  source: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export function RawView() {
  const [logs, setLogs] = useState<RawLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRaw = useCallback(async () => {
    setLoading(true);
    try {
      const [dailyRes, weightRes, bloodRes] = await Promise.all([
        fetch("/api/daily"),
        fetch("/api/weight"),
        fetch("/api/bloodwork"),
      ]);
      const [daily, weights, blood] = await Promise.all([
        dailyRes.json(),
        weightRes.json(),
        bloodRes.json(),
      ]);

      const entries: RawLog[] = [];

      for (const d of daily || []) {
        entries.push({ source: "daily_log", timestamp: d.day, data: d });
      }

      for (const w of weights || []) {
        entries.push({ source: "weight", timestamp: w.day, data: { weight_lbs: w.weight_lbs, logged_at: w.logged_at } });
      }

      for (const b of blood || []) {
        entries.push({ source: "bloodwork", timestamp: b.test_date, data: { marker: b.marker, value: b.value, unit: b.unit, status: b.status } });
      }

      entries.sort((a, b) => {
        const cmp = b.timestamp.localeCompare(a.timestamp);
        if (cmp !== 0) return cmp;
        return a.source.localeCompare(b.source);
      });

      setLogs(entries);
    } catch {
      setLogs([{ source: "error", timestamp: new Date().toISOString(), data: { message: "Failed to fetch" } }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRaw(); }, [fetchRaw]);

  const sourceColor = (s: string): string => {
    if (s === "daily_log") return "#999";
    if (s === "weight") return "#c084fc";
    if (s === "bloodwork") return "#f87171";
    return "#666";
  };

  return (
    <div
      className="font-mono text-[12px] leading-[1.6] overflow-auto"
      style={{
        background: "#0a0a0a",
        borderRadius: 8,
        border: "1px solid #1a1a1a",
        padding: "1rem",
        maxHeight: "calc(100vh - 140px)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span style={{ color: "#4ade80" }}>$ health-dump</span>
        <button
          onClick={fetchRaw}
          disabled={loading}
          style={{
            background: "none",
            border: "1px solid #333",
            color: "#666",
            fontSize: 11,
            fontFamily: "inherit",
            padding: "0.2rem 0.5rem",
            borderRadius: 3,
          }}
        >
          {loading ? "loading..." : "refresh"}
        </button>
      </div>

      {logs.map((log, i) => (
        <div key={i} className="mb-1" style={{ borderBottom: "1px solid #111", paddingBottom: 4 }}>
          <div>
            <span style={{ color: "#555" }}>[</span>
            <span style={{ color: "#888" }}>{log.timestamp}</span>
            <span style={{ color: "#555" }}>]</span>
            {" "}
            <span style={{ color: sourceColor(log.source), fontWeight: 600 }}>{log.source}</span>
          </div>
          <div style={{ color: "#777", paddingLeft: "1rem", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {formatData(log.data)}
          </div>
        </div>
      ))}

      {logs.length === 0 && !loading && (
        <div style={{ color: "#555" }}>No data. Run `npm run seed` to generate sample data.</div>
      )}
      {loading && (
        <div style={{ color: "#555" }}>fetching...</div>
      )}

      <div className="mt-3" style={{ color: "#333" }}>
        --- end of dump ---
      </div>
    </div>
  );
}

function formatData(data: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (val == null) continue;
    if (typeof val === "object" && !Array.isArray(val)) {
      const inner = Object.entries(val as Record<string, unknown>)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      parts.push(`${key}={${inner}}`);
    } else {
      parts.push(`${key}=${val}`);
    }
  }
  return parts.join("  ");
}
