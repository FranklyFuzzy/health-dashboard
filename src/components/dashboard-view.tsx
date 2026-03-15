"use client";

import { useState, useMemo, memo, useCallback } from "react";
import { useDay, useDailyLogs, localToday } from "@/lib/hooks/use-health-data";
import { TARGETS } from "@/lib/constants";
import type { DailyLog } from "@/lib/types";

const CARD: React.CSSProperties = { background: "#111", borderRadius: 16, padding: "20px", border: "1px solid #1a1a1a", overflow: "hidden", display: "flex", flexDirection: "column" };

function rc(s: number | null) {
  if (!s) return "var(--text-muted)";
  return s >= 70 ? "var(--accent)" : s >= 50 ? "#f0c040" : "var(--negative)";
}

// --- Ring ---
const Ring = memo(function Ring({ value, max, color = "var(--accent)", size = 88, unit }: {
  value: number; max: number; color?: string; size?: number; unit?: string;
}) {
  const pct = Math.min(value / max, 1);
  const r = size * 0.4, cx = size / 2, cy = size / 2, sw = size * 0.1;
  const circ = Math.round(2 * Math.PI * r * 10) / 10;
  const offset = Math.round(circ * (1 - pct) * 10) / 10;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a1a" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${circ}`} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: "stroke-dashoffset 0.5s" }} />
      <text x={cx} y={unit ? cy - size * 0.04 : cy + 1} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={size * 0.22} fontWeight="800">{value}</text>
      {unit ? <text x={cx} y={cy + size * 0.12} textAnchor="middle" dominantBaseline="central" fill="#555" fontSize={size * 0.1} fontWeight="500">{unit}</text> : null}
    </svg>
  );
});

// --- Bar chart with Y-axis and hover tooltip above ---
const Bars = memo(function Bars({ data, labels, color, unit, target, height = 70, yLabels }: {
  data: number[]; labels: string[]; color: string; unit?: string; target?: number; height?: number; yLabels?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const onLeave = useCallback(() => setHover(null), []);
  if (data.length === 0) return null;

  let max = target || 0;
  for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
  if (max === 0) max = 1;

  const showY = yLabels !== false;
  const W = 220, H = height, LM = showY ? 28 : 4, BM = 14;
  const chartH = H - BM;
  const gap = 4;
  const barW = Math.max((W - LM - gap * (data.length - 1)) / data.length, 4);

  // Tooltip follows actual bar center position in the viewBox
  const tipPct = hover != null ? ((LM + hover * (barW + gap) + barW / 2) / W) * 100 : 50;

  return (
    <div style={{ position: "relative" }}>
      {hover != null ? (
        <div style={{ position: "absolute", top: -20, left: `${tipPct}%`, transform: "translateX(-50%)", fontSize: 11, fontWeight: 600, color, zIndex: 1, whiteSpace: "nowrap" }}>
          {labels[hover]} &middot; {Math.round(data[hover])}{unit || ""}
        </div>
      ) : null}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} onMouseLeave={onLeave}>
        {/* Y-axis */}
        {showY ? <>
          <text x={LM - 4} y={8} fill="#444" fontSize="7" textAnchor="end">{Math.round(max)}</text>
          <text x={LM - 4} y={chartH} fill="#444" fontSize="7" textAnchor="end">0</text>
          <line x1={LM} y1={2} x2={LM} y2={chartH} stroke="#1a1a1a" strokeWidth="1" />
        </> : null}
        {/* Target line */}
        {target != null ? (() => {
          const y = Math.round((2 + (1 - target / max) * (chartH - 6)) * 10) / 10;
          return <line x1={LM} y1={y} x2={W} y2={y} stroke="#333" strokeWidth="1" strokeDasharray="4,4" />;
        })() : null}
        {data.map((v, i) => {
          const h = Math.max(Math.round((v / max) * (chartH - 4) * 10) / 10, 2);
          const isH = hover === i;
          const x = LM + i * (barW + gap);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} style={{ cursor: "pointer" }}>
              <rect x={x} y={0} width={barW} height={H} fill="transparent" />
              <rect x={Math.round(x * 10) / 10} y={Math.round((chartH - h) * 10) / 10} width={Math.round(barW * 10) / 10} height={h}
                rx="3" fill={color} opacity={isH ? 1 : 0.65} style={{ transition: "opacity 0.1s" }} />
            </g>
          );
        })}
        {/* X-axis dates */}
        {labels.map((l, i) => {
          const x = LM + i * (barW + gap) + barW / 2;
          return (labels.length <= 7 || i === 0 || i === labels.length - 1)
            ? <text key={i} x={x} y={H - 1} fill="#444" fontSize="7" textAnchor="middle">{l}</text>
            : null;
        })}
      </svg>
    </div>
  );
});

// --- Sparkline with Y-axis and hover tooltip above ---
const Spark = memo(function Spark({ data, labels, color, unit, height = 70, yLabels }: {
  data: number[]; labels: string[]; color: string; unit?: string; height?: number; yLabels?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const onLeave = useCallback(() => setHover(null), []);
  if (data.length < 2) return null;

  let min = data[0], max = data[0];
  for (let i = 1; i < data.length; i++) { if (data[i] < min) min = data[i]; if (data[i] > max) max = data[i]; }
  const range = max - min || 1;

  const showY = yLabels !== false;
  const W = 220, H = height, LM = showY ? 28 : 4, BM = 14;
  const chartH = H - BM;
  const px = 10;

  const pts = data.map((v, i) => ({
    x: Math.round((LM + px + (i / (data.length - 1)) * (W - LM - px * 2)) * 10) / 10,
    y: Math.round((8 + (1 - (v - min) / range) * (chartH - 16)) * 10) / 10,
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join("");
  const area = `${path}L${pts[pts.length - 1].x},${chartH}L${pts[0].x},${chartH}Z`;

  const hoverVal = hover != null ? data[hover] : null;
  const fmtVal = hoverVal != null ? (hoverVal % 1 !== 0 ? hoverVal.toFixed(1) : String(hoverVal)) : "";

  // Tooltip follows actual point position in the viewBox
  const tipPct = hover != null ? (pts[hover].x / W) * 100 : 50;

  return (
    <div style={{ position: "relative" }}>
      {hover != null ? (
        <div style={{ position: "absolute", top: -20, left: `${tipPct}%`, transform: "translateX(-50%)", fontSize: 11, fontWeight: 600, color, zIndex: 1, whiteSpace: "nowrap" }}>
          {labels[hover]} &middot; {fmtVal}{unit || ""}
        </div>
      ) : null}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} onMouseLeave={onLeave} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Y-axis */}
        {showY ? <>
          <text x={LM - 4} y={12} fill="#444" fontSize="7" textAnchor="end">{typeof max === "number" && max % 1 !== 0 ? max.toFixed(1) : max}</text>
          <text x={LM - 4} y={chartH - 2} fill="#444" fontSize="7" textAnchor="end">{typeof min === "number" && min % 1 !== 0 ? min.toFixed(1) : min}</text>
          <line x1={LM} y1={4} x2={LM} y2={chartH} stroke="#1a1a1a" strokeWidth="1" />
        </> : null}
        <path d={area} fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, "")})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" />
        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} style={{ cursor: "pointer" }}>
            <rect x={p.x - 12} y={0} width={24} height={H} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={hover === i ? 5 : 0} fill={color} style={{ transition: "all 0.15s" }} />
            {hover === i ? <circle cx={p.x} cy={p.y} r={9} fill={color} opacity="0.12" /> : null}
          </g>
        ))}
        {hover != null ? <line x1={pts[hover].x} y1={4} x2={pts[hover].x} y2={chartH} stroke="#333" strokeWidth="1" /> : null}
        {/* X-axis dates */}
        {labels.map((l, i) => {
          const x = pts[i]?.x;
          return x != null && (labels.length <= 7 || i === 0 || i === labels.length - 1)
            ? <text key={i} x={x} y={H - 1} fill="#444" fontSize="7" textAnchor="middle">{l}</text>
            : null;
        })}
      </svg>
    </div>
  );
});

// --- Macro bar ---
const MacroBar = memo(function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = Math.min((value / target) * 100, 100);
  return (
    <div className="flex items-center gap-2" style={{ fontSize: 11 }}>
      <span style={{ color: "#666", width: 14, fontWeight: 600 }}>{label}</span>
      <div className="flex-1" style={{ height: 8, borderRadius: 4, background: "#1a1a1a" }}>
        <div style={{ height: "100%", width: `${Math.round(pct)}%`, borderRadius: 4, background: color, transition: "width 0.3s" }} />
      </div>
      <span className="tabular-nums" style={{ color: "#aaa", width: 60, textAlign: "right", fontSize: 11 }}>
        {Math.round(value)}<span style={{ color: "#555" }}>/{target}g</span>
      </span>
    </div>
  );
});

// --- Weight input card ---
function WeightCard({ today, weightTrend, sparkData, sparkLabels, defaultDay }: {
  today: Partial<DailyLog>; weightTrend: number | null; sparkData: number[]; sparkLabels: string[]; defaultDay?: string;
}) {
  const [wt, setWt] = useState("");
  const [day, setDay] = useState(defaultDay || localToday);

  const save = useCallback(async () => {
    if (!wt) return;
    await fetch("/api/weight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight_lbs: parseFloat(wt), day }),
    });
    setWt("");
    window.location.reload();
  }, [wt, day]);

  return (
    <div style={{ ...CARD, minHeight: 180 }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>Weight</div>
      <div className="flex items-baseline gap-1 mt-2">
        <span className="tabular-nums" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{today.weight_lbs ?? "--"}</span>
        <span style={{ fontSize: 14, color: "#555", fontWeight: 500 }}>lbs</span>
      </div>
      {weightTrend != null ? (
        <div style={{ fontSize: 12, color: weightTrend < 0 ? "var(--accent)" : "var(--negative)", marginTop: 3, fontWeight: 600 }}>
          {weightTrend >= 0 ? "+" : ""}{weightTrend.toFixed(1)} vs 7d
        </div>
      ) : null}
      <div style={{ marginTop: "auto" }}>
        <Spark data={sparkData} labels={sparkLabels} color="var(--blue)" unit=" lbs" height={40} yLabels={false} />
      </div>
      <div className="flex gap-2 mt-2 items-end">
        <input type="date" value={day} onChange={e => setDay(e.target.value)}
          style={{ background: "#1a1a1a", border: "1px solid #222", color: "#aaa", fontSize: 11, fontFamily: "inherit", padding: "4px 6px", borderRadius: 6, outline: "none", width: 110 }} />
        <input type="number" step="0.1" value={wt} onChange={e => setWt(e.target.value)} onKeyDown={e => e.key === "Enter" && save()}
          placeholder="lbs" style={{ background: "#1a1a1a", border: "1px solid #222", color: "#fff", fontSize: 13, fontFamily: "inherit", padding: "4px 8px", borderRadius: 6, outline: "none", width: 65 }} />
        <button onClick={save} style={{ background: "var(--accent)", color: "#000", fontSize: 11, fontWeight: 700, fontFamily: "inherit", padding: "5px 10px", borderRadius: 6, border: "none" }}>Log</button>
      </div>
    </div>
  );
}

// --- Big Charts ---

function WeightChart({ logs }: { logs: DailyLog[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const onLeave = useCallback(() => setHover(null), []);
  const data = useMemo(() => logs.filter(l => l.weight_lbs != null).toSorted((a, b) => a.day.localeCompare(b.day)).slice(-30), [logs]);
  if (data.length < 2) return null;

  const weights = data.map(d => d.weight_lbs!);
  let min = weights[0], max = weights[0];
  for (let i = 1; i < weights.length; i++) { if (weights[i] < min) min = weights[i]; if (weights[i] > max) max = weights[i]; }
  // Add more padding so the line uses more vertical space
  const pad = Math.max((max - min) * 0.3, 1);
  min -= pad; max += pad;
  const range = max - min || 1;
  const W = 500, H = 160, LM = 28, RM = 4, BM = 22;
  const chartH = H - BM;

  const pts = data.map((d, i) => ({
    x: Math.round((LM + (i / (data.length - 1)) * (W - LM - RM)) * 10) / 10,
    y: Math.round((10 + (1 - (d.weight_lbs! - min) / range) * (chartH - 14)) * 10) / 10,
    day: d.day.slice(5), val: d.weight_lbs!,
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join("");
  const area = `${path}L${pts[pts.length - 1].x},${chartH}L${pts[0].x},${chartH}Z`;
  const delta = weights[weights.length - 1] - weights[0];

  return (
    <div style={CARD}>
      <div className="flex items-baseline justify-between mb-3">
        <span style={{ fontSize: 15, fontWeight: 700 }}>Weight</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: delta < 0 ? "var(--accent)" : "var(--negative)" }}>
          {hover != null ? `${pts[hover].day} \u00B7 ${pts[hover].val} lbs` : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} lbs`}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", marginTop: "auto" }} onMouseLeave={onLeave}>
        <defs>
          <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Y-axis labels + grid */}
        {[0, .25, .5, .75, 1].map(f => {
          const y = 10 + f * (chartH - 14);
          const val = (max - f * (max - min)).toFixed(0);
          return <g key={f}>
            <line x1={LM} y1={y} x2={W - RM} y2={y} stroke="#1a1a1a" />
            <text x={LM - 6} y={y + 4} fill="#555" fontSize="10" textAnchor="end">{val}</text>
          </g>;
        })}
        <path d={area} fill="url(#wg)" />
        <path d={path} fill="none" stroke="var(--blue)" strokeWidth="2" />
        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} style={{ cursor: "pointer" }}>
            <rect x={p.x - 8} y={0} width={16} height={H} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={hover === i ? 5 : 2} fill={hover === i ? "#fff" : "var(--blue)"} style={{ transition: "all 0.1s" }} />
          </g>
        ))}
        {hover != null ? <line x1={pts[hover].x} y1={10} x2={pts[hover].x} y2={chartH} stroke="#333" strokeWidth="1" /> : null}
        {pts.map((p, i) => (
          i % Math.ceil(pts.length / 6) === 0 || i === pts.length - 1
            ? <text key={`d${i}`} x={p.x} y={H - 4} fill="#555" fontSize="10" textAnchor="middle">{p.day}</text>
            : null
        ))}
      </svg>
    </div>
  );
}

function CalBalanceChart({ logs }: { logs: DailyLog[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const onLeave = useCallback(() => setHover(null), []);

  const data = useMemo(() => logs
    .filter(l => l.food_calories != null && l.total_calories != null && l.active_calories != null)
    .toSorted((a, b) => a.day.localeCompare(b.day))
    .slice(-14)
    .map(l => {
      const bmr = l.total_calories! - l.active_calories!;
      const workouts = (l.oura_workout_calories || 0) + (l.workout_calories || 0);
      const burn = bmr + workouts;
      return { day: l.day, intake: l.food_calories!, bmr, workouts, burn, deficit: burn - l.food_calories! };
    }),
  [logs]);

  if (!data.length) return null;

  // Find actual min/max of deficits to position zero line dynamically
  let minDef = 0, maxDef = 0;
  for (const d of data) {
    if (d.deficit > maxDef) maxDef = d.deficit;
    if (d.deficit < minDef) minDef = d.deficit;
  }
  // Add padding so bars don't touch edges
  const topVal = Math.max(maxDef, 0) + 100;   // surplus side (above zero)
  const botVal = Math.min(minDef, 0) - 100;    // deficit side (below zero)
  const totalRange = topVal - botVal;

  const W = 500, H = 180, LM = 20, RM = 4, BM = 22;
  const chartH = H - BM;
  const bw = Math.round((W - LM - RM) / data.length * 0.6 * 10) / 10;

  // Zero line position — proportional to where 0 sits in the range
  const zeroY = Math.round(10 + (topVal / totalRange) * (chartH - 14));

  const hd = hover != null ? data[hover] : null;

  return (
    <div style={CARD}>
      <div className="flex items-baseline justify-between mb-1">
        <span style={{ fontSize: 15, fontWeight: 700 }}>Calorie Balance</span>
        <span style={{ fontSize: 11, color: "#555" }}>BMR + workouts &minus; food</span>
      </div>
      {/* Tooltip above chart */}
      <div style={{ height: 20, fontSize: 11, color: "#888", marginBottom: 4 }}>
        {hd ? (
          <span>
            {hd.day.slice(5)}: {hd.burn} burn &minus; {hd.intake} food = <span style={{ color: hd.deficit >= 0 ? "var(--accent)" : "var(--negative)", fontWeight: 700 }}>{hd.deficit >= 0 ? "-" : "+"}{Math.abs(hd.deficit)} cal</span>
          </span>
        ) : null}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", marginTop: "auto" }} onMouseLeave={onLeave}>
        {/* Y-axis */}
        <text x={LM - 4} y={zeroY + 4} fill="#666" fontSize="10" textAnchor="end">0</text>
        <line x1={LM} y1={10} x2={LM} y2={chartH} stroke="#1a1a1a" strokeWidth="1" />
        {/* Zero line */}
        <line x1={LM} y1={zeroY} x2={W - RM} y2={zeroY} stroke="#444" strokeWidth="1" />
        {data.map((d, i) => {
          const cx = Math.round((LM + ((i + .5) / data.length) * (W - LM - RM)) * 10) / 10;
          const barH = Math.max(Math.round((Math.abs(d.deficit) / totalRange) * (chartH - 14) * 10) / 10, 4);
          const isDeficit = d.deficit >= 0;
          const y = isDeficit ? zeroY - barH : zeroY;
          const isH = hover === i;
          const barColor = isDeficit ? "var(--accent)" : "var(--negative)";
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} style={{ cursor: "pointer" }}>
              <rect x={cx - bw / 2 - 4} y={0} width={bw + 8} height={H} fill="transparent" />
              <rect x={Math.round((cx - bw / 2) * 10) / 10} y={Math.round(y * 10) / 10} width={bw} height={barH} rx="3"
                fill={barColor} opacity={isH ? 1 : 0.6} style={{ transition: "opacity 0.1s" }} />
              <text x={cx} y={H - 4} fill={isH ? "#888" : "#555"} fontSize="10" textAnchor="middle">{d.day.slice(8)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --- Sparkline builder ---
function buildSparklines(logs: DailyLog[]) {
  const sorted = logs.toSorted((a, b) => a.day.localeCompare(b.day));
  const last7 = sorted.slice(-7);
  const build = (fn: (l: DailyLog) => number | null) => {
    const f = last7.filter(l => fn(l) != null);
    return { data: f.map(l => fn(l)!), labels: f.map(l => l.day.slice(5)) };
  };
  return {
    sleep: build(l => l.sleep_hours),
    recovery: build(l => l.readiness_score),
    steps: build(l => l.steps),
    protein: build(l => l.protein_g),
    weight: build(l => l.weight_lbs),
    activeCal: build(l => l.active_calories),
  };
}

// --- Main ---

function shiftDay(day: string, delta: number): string {
  const d = new Date(day + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(day: string): string {
  const today = localToday();
  if (day === today) return "Today";
  if (day === shiftDay(today, -1)) return "Yesterday";
  const dt = new Date(day + "T12:00:00");
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function DashboardView() {
  const [selectedDay, setSelectedDay] = useState(localToday);
  const { data: dayData } = useDay(selectedDay);
  const { data: logs } = useDailyLogs();
  const all = logs || [];
  const d = dayData || ({} as Partial<DailyLog>);
  const isToday = selectedDay === localToday();

  const s = useMemo(() => buildSparklines(all), [all]);

  const weightTrend = useMemo(() => {
    const rw = all.filter(l => l.weight_lbs).toSorted((a, b) => b.day.localeCompare(a.day)).slice(0, 7);
    if (rw.length === 0) return null;
    const avg = rw.reduce((sum, l) => sum + l.weight_lbs!, 0) / rw.length;
    return d.weight_lbs ? d.weight_lbs - avg : null;
  }, [all, d.weight_lbs]);


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Date navigator */}
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedDay(shiftDay(selectedDay, -1))}
          style={{ background: "#1a1a1a", border: "1px solid #222", color: "#888", width: 32, height: 32, borderRadius: 8, fontSize: 16, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, minWidth: 140, textAlign: "center" }}>{formatDayLabel(selectedDay)}</span>
        <button onClick={() => { if (!isToday) setSelectedDay(shiftDay(selectedDay, 1)); }}
          style={{ background: "#1a1a1a", border: "1px solid #222", color: isToday ? "#333" : "#888", width: 32, height: 32, borderRadius: 8, fontSize: 16, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", cursor: isToday ? "default" : "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
        </button>
        {!isToday ? (
          <button onClick={() => setSelectedDay(localToday())}
            style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            Today
          </button>
        ) : null}
      </div>

      {/* 3x3 tile grid — all tiles same height */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridAutoRows: "280px", gap: 14 }}>
      {/* Calories + macros — centered */}
      <div style={CARD}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Calories</div>
        <div className="flex items-center gap-4" style={{ margin: "auto 0" }}>
          <Ring value={d.food_calories || 0} max={TARGETS.calories} color="#fb923c" />
          <div className="flex-1 space-y-2">
            <MacroBar label="P" value={d.protein_g || 0} target={TARGETS.protein_g} color="var(--accent)" />
            <MacroBar label="C" value={d.carbs_g || 0} target={TARGETS.carbs_g} color="var(--blue)" />
            <MacroBar label="F" value={d.fat_g || 0} target={TARGETS.fat_g} color="var(--purple)" />
          </div>
        </div>
        <div className="mt-3 tabular-nums" style={{ fontSize: 12, color: "#fb923c" }}>
          {d.food_calories || 0}<span style={{ color: "#555" }}> / {TARGETS.calories} kcal</span>
        </div>
      </div>

      {/* Sleep */}
      <div style={CARD}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Sleep</div>
        <div className="flex items-baseline gap-1 mt-2">
          <span className="tabular-nums" style={{ fontSize: 36, fontWeight: 800, color: "var(--blue)", lineHeight: 1 }}>{d.sleep_hours?.toFixed(1) || "--"}</span>
          <span style={{ fontSize: 14, color: "#555" }}>hrs</span>
        </div>
        {d.sleep_score != null ? <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>Score {d.sleep_score}</div> : null}
        <div style={{ marginTop: "auto" }}>
          <Bars data={s.sleep.data} labels={s.sleep.labels} color="var(--blue)" unit="h" yLabels={false} />
        </div>
      </div>

      {/* Recovery */}
      <div style={CARD}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Recovery</div>
        <div className="flex items-baseline gap-1 mt-2">
          <span className="tabular-nums" style={{ fontSize: 36, fontWeight: 800, color: rc(d.readiness_score ?? null), lineHeight: 1 }}>{d.readiness_score ?? "--"}</span>
          <span style={{ fontSize: 14, color: "#555" }}>/100</span>
        </div>
        <div style={{ marginTop: "auto" }}>
          <Spark data={s.recovery.data} labels={s.recovery.labels} color={rc(d.readiness_score ?? null)} yLabels={false} />
        </div>
      </div>

      {/* Steps */}
      <div style={CARD}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Steps</div>
        <div className="flex items-baseline gap-1 mt-2">
          <span className="tabular-nums" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{d.steps?.toLocaleString() || "--"}</span>
        </div>
        <div style={{ marginTop: "auto" }}>
          <Spark data={s.steps.data} labels={s.steps.labels} color="var(--accent)" yLabels={false} />
        </div>
      </div>

      {/* Workout — ring + stats */}
      <div style={CARD}>
        <div className="flex items-baseline justify-between">
          <span style={{ fontSize: 14, fontWeight: 700 }}>Workout</span>
          {d.workout_name ? <span style={{ fontSize: 11, color: "#444" }}>{d.workout_name}</span> : null}
        </div>
        {d.workout_completed ? (
          <div className="flex items-center justify-center" style={{ margin: "auto 0" }}>
            <Ring value={d.workout_duration_min || 0} max={TARGETS.workout_min} color="var(--accent)" size={130} unit="min" />
          </div>
        ) : (
          <div className="flex items-center justify-center" style={{ margin: "auto 0" }}>
            <Ring value={0} max={TARGETS.workout_min} color="#333" size={130} unit="min" />
          </div>
        )}
        <div className="flex justify-center gap-6" style={{ marginTop: 4 }}>
          <div style={{ textAlign: "center" }}>
            <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 700, color: d.workout_completed ? "var(--accent)" : "#333" }}>{d.workout_duration_min || "--"}</div>
            <div style={{ fontSize: 10, color: "#555" }}>min</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 700, color: d.workout_completed ? "var(--accent)" : "#333" }}>{d.workout_calories || "--"}</div>
            <div style={{ fontSize: 10, color: "#555" }}>cal</div>
          </div>
        </div>
      </div>

      {/* Weight — with input */}
      <WeightCard today={d} weightTrend={weightTrend} sparkData={s.weight.data} sparkLabels={s.weight.labels} defaultDay={selectedDay} />

      {/* Active Calories */}
      <div style={CARD}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Active Calories</div>
        <div className="flex items-baseline gap-1 mt-2">
          <span className="tabular-nums" style={{ fontSize: 36, fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>{d.active_calories?.toLocaleString() || "--"}</span>
          <span style={{ fontSize: 14, color: "#555" }}>kcal</span>
        </div>
        <div style={{ marginTop: "auto" }}>
          <Bars data={s.activeCal.data} labels={s.activeCal.labels} color="var(--accent)" unit=" cal" yLabels={false} />
        </div>
      </div>

      {/* Protein */}
      <div style={CARD}>
        <div className="flex items-baseline justify-between">
          <span style={{ fontSize: 14, fontWeight: 700 }}>Protein</span>
          <span style={{ fontSize: 11, color: "#444" }}>target {TARGETS.protein_g}g</span>
        </div>
        <div className="flex items-baseline gap-1 mt-2">
          <span className="tabular-nums" style={{ fontSize: 36, fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>{d.protein_g ? Math.round(d.protein_g) : "--"}</span>
          <span style={{ fontSize: 14, color: "#555" }}>g</span>
        </div>
        <div style={{ marginTop: "auto" }}>
          <Bars data={s.protein.data} labels={s.protein.labels} color="var(--accent)" unit="g" target={TARGETS.protein_g} yLabels={false} />
        </div>
      </div>

      {/* Water — fill-up glass visual */}
      <div style={{ ...CARD, position: "relative" }}>
        <div className="flex items-baseline justify-between" style={{ position: "relative", zIndex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Water</span>
          <span style={{ fontSize: 11, color: "#555" }}>{d.water_oz || 0}/{TARGETS.water_oz} oz</span>
        </div>
        <div style={{ position: "relative", zIndex: 1, margin: "auto 0", textAlign: "center" }}>
          <div className="tabular-nums" style={{ fontSize: 48, fontWeight: 800, color: "#38BDF8", lineHeight: 1 }}>{d.water_oz ?? 0}</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>of {TARGETS.water_oz} oz</div>
        </div>
        {/* Water fill background */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: `${Math.min(((d.water_oz || 0) / TARGETS.water_oz) * 100, 100)}%`,
          background: "linear-gradient(to top, rgba(56, 189, 248, 0.12), rgba(56, 189, 248, 0.03))",
          transition: "height 0.5s ease",
          borderRadius: "0 0 16px 16px",
        }} />
      </div>

      </div>

      {/* Big trend charts — side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <WeightChart logs={all} />
        <CalBalanceChart logs={all} />
      </div>
    </div>
  );
}
