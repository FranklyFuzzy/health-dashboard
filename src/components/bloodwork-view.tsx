"use client";

import { useState, useMemo, useCallback, memo } from "react";
import { useBloodwork } from "@/lib/hooks/use-health-data";
import type { BloodResult } from "@/lib/types";

const CARD: React.CSSProperties = { background: "#111", borderRadius: 16, padding: "16px 20px", border: "1px solid #1a1a1a", overflow: "hidden", display: "flex", flexDirection: "column" };

const STATUS_COLORS: Record<string, string> = {
  optimal: "#C8FF00",
  average: "#888",
  outOfRange: "#ff4444",
};

const CATEGORIES: { label: string; markers: string[] }[] = [
  {
    label: "Hormones",
    markers: ["Total Testosterone", "Free Testosterone", "Estrogen", "SHBG", "Thyroid Stimulating Hormone", "Free T3", "Luteinizing Hormone", "FSH"],
  },
  {
    label: "Lipids",
    markers: ["Total Cholesterol", "LDL Cholesterol", "HDL Cholesterol", "Triglycerides", "ApoB", "LDL/ApoB Ratio", "Total Cholesterol/HDL Ratio", "Triglycerides/HDL Ratio", "Remnant Cholesterol"],
  },
  {
    label: "Metabolic & Inflammation",
    markers: ["hs-CRP (High-Sensitivity C-Reactive Protein)", "Creatinine", "Albumin", "Ferritin", "Vitamin D"],
  },
];

const SHORT_NAMES: Record<string, string> = {
  "hs-CRP (High-Sensitivity C-Reactive Protein)": "hs-CRP",
  "Thyroid Stimulating Hormone": "TSH",
  "Total Cholesterol/HDL Ratio": "TC/HDL Ratio",
  "Triglycerides/HDL Ratio": "TG/HDL Ratio",
  "Luteinizing Hormone": "LH",
};

function displayName(marker: string): string {
  return SHORT_NAMES[marker] || marker;
}

function fmtVal(v: number): string {
  return v % 1 !== 0 ? v.toFixed(1) : String(v);
}

function fmtDate(d: string): string {
  const [, m, day] = d.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${day}`;
}

// --- Interactive sparkline ---
const MarkerSparkline = memo(function MarkerSparkline({ points, refLow, refHigh, color, hoverIdx, onHover, onLeave }: {
  points: { date: string; value: number; status: string | null }[];
  refLow: number | null;
  refHigh: number | null;
  color: string;
  hoverIdx: number | null;
  onHover: (i: number) => void;
  onLeave: () => void;
}) {
  if (points.length < 2) return null;

  const values = points.map(p => p.value);
  let min = values[0], max = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < min) min = values[i];
    if (values[i] > max) max = values[i];
  }
  if (refLow != null && refLow < min) min = refLow;
  if (refHigh != null && refHigh > max) max = refHigh;
  const pad = Math.max((max - min) * 0.15, 0.01);
  min -= pad; max += pad;
  const range = max - min || 1;

  const W = 160, H = 40;
  const pts = points.map((p, i) => ({
    x: Math.round((8 + (i / (points.length - 1)) * (W - 16)) * 10) / 10,
    y: Math.round((6 + (1 - (p.value - min) / range) * (H - 12)) * 10) / 10,
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join("");

  const refY1 = refHigh != null ? 6 + (1 - (refHigh - min) / range) * (H - 12) : null;
  const refY2 = refLow != null ? 6 + (1 - (refLow - min) / range) * (H - 12) : null;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", cursor: "crosshair" }} onMouseLeave={onLeave}>
      {refY1 != null && refY2 != null ? (
        <rect x={0} y={Math.round(refY1)} width={W} height={Math.max(Math.round(refY2 - refY1), 1)} fill="#C8FF00" opacity="0.06" rx="2" />
      ) : null}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" opacity={0.7} />
      {/* Hover targets — wide invisible rects for each point */}
      {pts.map((p, i) => {
        const isH = hoverIdx === i;
        const ptColor = STATUS_COLORS[points[i].status || "average"] || color;
        return (
          <g key={i} onMouseEnter={() => onHover(i)}>
            <rect
              x={i === 0 ? 0 : (pts[i - 1].x + p.x) / 2}
              y={0}
              width={i === 0 ? (pts[1].x + p.x) / 2 : i === pts.length - 1 ? W - (pts[i - 1].x + p.x) / 2 : (pts[i + 1].x - pts[i - 1].x) / 2}
              height={H}
              fill="transparent"
            />
            <circle cx={p.x} cy={p.y} r={isH ? 4 : 2} fill={ptColor} opacity={isH ? 1 : 0.5} style={{ transition: "r 0.1s, opacity 0.1s" }} />
            {isH ? <circle cx={p.x} cy={p.y} r={8} fill={ptColor} opacity={0.12} /> : null}
          </g>
        );
      })}
      {hoverIdx != null ? (
        <line x1={pts[hoverIdx].x} y1={4} x2={pts[hoverIdx].x} y2={H - 4} stroke="#333" strokeWidth="1" />
      ) : null}
    </svg>
  );
});

// --- Single marker tile ---
function MarkerTile({ marker, results }: { marker: string; results: BloodResult[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const onLeave = useCallback(() => setHoverIdx(null), []);

  const sorted = results.toSorted((a, b) => a.test_date.localeCompare(b.test_date));
  const latest = sorted[sorted.length - 1];
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const delta = prev ? latest.value - prev.value : null;
  const latestColor = STATUS_COLORS[latest.status || "average"] || "#888";

  const points = sorted.map(r => ({ date: r.test_date, value: r.value, status: r.status }));

  // When hovering, show the hovered point's info instead of latest
  const displayResult = hoverIdx != null ? sorted[hoverIdx] : latest;
  const displayColor = STATUS_COLORS[displayResult.status || "average"] || "#888";
  const displayDelta = hoverIdx != null && hoverIdx > 0
    ? sorted[hoverIdx].value - sorted[hoverIdx - 1].value
    : delta;

  return (
    <div style={CARD}>
      <div className="flex items-start justify-between gap-2" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#aaa", lineHeight: 1.2 }}>{displayName(marker)}</span>
        <span style={{ fontSize: 10, color: hoverIdx != null ? "#666" : "#444", whiteSpace: "nowrap", flexShrink: 0 }}>
          {hoverIdx != null ? fmtDate(displayResult.test_date) : latest.unit}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="tabular-nums" style={{ fontSize: 28, fontWeight: 800, color: displayColor, lineHeight: 1 }}>{fmtVal(displayResult.value)}</span>
        {displayDelta != null ? (
          <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 600, color: displayDelta === 0 ? "#555" : "#888" }}>
            {displayDelta > 0 ? "+" : ""}{fmtVal(displayDelta)}
          </span>
        ) : null}
      </div>

      {latest.reference_low != null && latest.reference_high != null ? (
        <div style={{ fontSize: 10, color: "#444", marginTop: 3 }}>
          ref: {fmtVal(latest.reference_low)} - {fmtVal(latest.reference_high)}
        </div>
      ) : null}

      <div style={{ marginTop: "auto", paddingTop: 8 }}>
        <MarkerSparkline
          points={points}
          refLow={latest.reference_low}
          refHigh={latest.reference_high}
          color={latestColor}
          hoverIdx={hoverIdx}
          onHover={setHoverIdx}
          onLeave={onLeave}
        />
      </div>

      {sorted.length >= 2 ? (
        <div className="flex justify-between" style={{ fontSize: 9, color: "#333", marginTop: 2 }}>
          <span>{sorted[0].test_date.slice(5)}</span>
          <span>{sorted[sorted.length - 1].test_date.slice(5)}</span>
        </div>
      ) : (
        <div style={{ fontSize: 9, color: "#333", marginTop: 2 }}>{latest.test_date.slice(5)}</div>
      )}
    </div>
  );
}

// --- Upload button (compact) ---
function UploadButton({ onUploaded }: { onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setMessage(null);

    let totalImported = 0;
    for (let i = 0; i < files.length; i++) {
      const text = await files[i].text();
      const res = await fetch("/api/bloodwork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      });
      const data = await res.json();
      if (data.imported) totalImported += data.imported;
    }

    setUploading(false);
    setMessage(`+${totalImported} results`);
    onUploaded();
    setTimeout(() => setMessage(null), 3000);
  }, [onUploaded]);

  return (
    <div className="flex items-center gap-2">
      {message ? <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>{message}</span> : null}
      <label style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        background: "#1a1a1a",
        border: "1px solid #222",
        borderRadius: 8,
        cursor: uploading ? "wait" : "pointer",
        color: "#888",
        flexShrink: 0,
      }}>
        {uploading ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
            <path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
        <input
          type="file"
          accept=".csv"
          multiple
          style={{ display: "none" }}
          onChange={e => { handleFiles(e.target.files); e.target.value = ""; }}
          disabled={uploading}
        />
      </label>
    </div>
  );
}

// --- Main view ---
export function BloodworkView() {
  const { data: results, isLoading, mutate } = useBloodwork();

  const grouped = useMemo(() => {
    if (!results?.length) return new Map<string, BloodResult[]>();
    const map = new Map<string, BloodResult[]>();
    for (const r of results) {
      const list = map.get(r.marker) || [];
      list.push(r);
      map.set(r.marker, list);
    }
    return map;
  }, [results]);

  const testDates = useMemo(() => {
    if (!results?.length) return [];
    const set = new Set(results.map(r => r.test_date));
    return [...set].sort();
  }, [results]);

  if (isLoading) return <div style={{ color: "#444" }}>Loading...</div>;

  const hasData = grouped.size > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header row with upload button */}
      <div className="flex items-center justify-between">
        <div style={{ fontSize: 11, color: "#444" }}>
          {hasData
            ? `${grouped.size} markers across ${testDates.length} tests (${fmtDate(testDates[0])} to ${fmtDate(testDates[testDates.length - 1])})`
            : "No blood work data yet"
          }
        </div>
        <UploadButton onUploaded={() => mutate()} />
      </div>

      {hasData ? (
        <>
          {CATEGORIES.map(cat => {
            const catMarkers = cat.markers.filter(m => grouped.has(m));
            if (!catMarkers.length) return null;
            return (
              <div key={cat.label}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                  {cat.label}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                  {catMarkers.map(m => (
                    <MarkerTile key={m} marker={m} results={grouped.get(m)!} />
                  ))}
                </div>
              </div>
            );
          })}

          {(() => {
            const categorized = new Set(CATEGORIES.flatMap(c => c.markers));
            const uncategorized = [...grouped.keys()].filter(m => !categorized.has(m));
            if (!uncategorized.length) return null;
            return (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                  Other
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                  {uncategorized.map(m => (
                    <MarkerTile key={m} marker={m} results={grouped.get(m)!} />
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      ) : null}
    </div>
  );
}
