"use client";

import { useState, useCallback } from "react";
import { useDailyLogs } from "@/lib/hooks/use-health-data";
import { TARGETS } from "@/lib/constants";
import type { DailyLog } from "@/lib/types";

const C = {
  food: "#fb923c",
  workout: "#C8FF00",
  sleep: "#7B8CFF",
  water: "#38BDF8",
  weight: "#aaa",
  deficit: "#C8FF00",
  surplus: "#ff4444",
  muted: "#444",
  text: "#888",
};

function rc(s: number | null) {
  if (s == null) return C.muted;
  return s >= 70 ? C.workout : s >= 50 ? "#f0c040" : "#ff4444";
}

function deficit(log: DailyLog): number | null {
  if (log.food_calories == null || log.total_calories == null || log.active_calories == null) return null;
  const bmr = log.total_calories - log.active_calories;
  const workouts = (log.garmin_workout_calories || 0) + (log.workout_calories || 0);
  return bmr + workouts - log.food_calories;
}

function exerciseCal(log: DailyLog): number | null {
  if (log.total_calories == null || log.active_calories == null) return null;
  return (log.garmin_workout_calories || 0) + (log.workout_calories || 0);
}

function formatDate(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}`;
}

// --- Editable cell ---
function EditableCell({ value, display, color, onSave }: {
  value: string | null; display: string; color: string;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step="0.1"
        value={input}
        onChange={e => setInput(e.target.value)}
        onBlur={() => { if (input) onSave(input); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === "Enter") { if (input) onSave(input); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
        style={{
          background: "#1a1a1a", border: "1px solid #333", color: "#fff",
          fontSize: 12, fontFamily: "inherit", padding: "1px 4px", borderRadius: 4,
          outline: "none", width: 55,
        }}
      />
    );
  }

  return (
    <span
      className="group flex items-center gap-1"
      style={{ cursor: "pointer", color }}
      onClick={() => { setInput(value || ""); setEditing(true); }}
    >
      <span>{display}</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        style={{ opacity: 0, transition: "opacity 0.1s", flexShrink: 0 }}
        className="pencil-icon"
      >
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </span>
  );
}

// --- Column definitions ---
type ColId = "date" | "weight" | "foodCal" | "protein" | "carbs" | "fat" | "exerciseCal" | "deficit" | "steps" | "activeCal" | "sleep" | "sleepScore" | "recovery" | "water" | "workoutName" | "workoutDuration";

interface ColDef {
  id: ColId;
  label: string;
  color?: string;
  width?: number;
  render: (log: DailyLog, helpers: Helpers) => React.ReactNode;
}

interface Helpers {
  saveWeight: (day: string, val: string) => void;
  saveWater: (day: string, val: string) => void;
}

const COLUMNS: ColDef[] = [
  {
    id: "date", label: "Date", width: 70,
    render: (log) => <span style={{ color: "#aaa", fontWeight: 500 }}>{formatDate(log.day)}</span>,
  },
  {
    id: "weight", label: "Weight", width: 65, color: C.weight,
    render: (log, h) => (
      <EditableCell
        value={log.weight_lbs?.toString() || null}
        display={log.weight_lbs != null ? `${log.weight_lbs}` : "---"}
        color={C.weight}
        onSave={(v) => h.saveWeight(log.day, v)}
      />
    ),
  },
  {
    id: "foodCal", label: "Calories", width: 65, color: C.food,
    render: (log) => <span style={{ color: C.food, fontWeight: 600 }}>{log.food_calories != null ? log.food_calories.toLocaleString() : "---"}</span>,
  },
  {
    id: "protein", label: "Protein", width: 50, color: C.food,
    render: (log) => <span style={{ color: C.food, opacity: 0.6 }}>{log.protein_g != null ? `${Math.round(log.protein_g)}g` : "---"}</span>,
  },
  {
    id: "carbs", label: "Carbs", width: 50, color: C.food,
    render: (log) => <span style={{ color: C.food, opacity: 0.6 }}>{log.carbs_g != null ? `${Math.round(log.carbs_g)}g` : "---"}</span>,
  },
  {
    id: "fat", label: "Fat", width: 45, color: C.food,
    render: (log) => <span style={{ color: C.food, opacity: 0.6 }}>{log.fat_g != null ? `${Math.round(log.fat_g)}g` : "---"}</span>,
  },
  {
    id: "water", label: "Water", width: 60, color: C.water,
    render: (log, h) => (
      <EditableCell
        value={log.water_oz?.toString() || null}
        display={log.water_oz != null ? `${log.water_oz}oz` : "---"}
        color={C.water}
        onSave={(v) => h.saveWater(log.day, v)}
      />
    ),
  },
  {
    id: "deficit", label: "Deficit", width: 70,
    render: (log) => {
      const def = deficit(log);
      return <span style={{ fontWeight: 700, color: def != null ? (def >= 0 ? C.surplus : C.deficit) : C.muted }}>
        {def != null ? `${def >= 0 ? "-" : "+"}${Math.abs(def)}` : "---"}
      </span>;
    },
  },
  {
    id: "exerciseCal", label: "Exercise Cal", width: 80, color: C.workout,
    render: (log) => <span style={{ color: C.workout }}>{exerciseCal(log)?.toLocaleString() ?? "---"}</span>,
  },
  {
    id: "workoutName", label: "Workout", width: 120, color: C.workout,
    render: (log) => <span style={{ color: log.workout_name ? C.workout : C.muted }}>{log.workout_name || (log.workout_completed ? "Workout" : "---")}</span>,
  },
  {
    id: "workoutDuration", label: "Duration", width: 60, color: C.workout,
    render: (log) => <span style={{ color: C.workout }}>{log.workout_duration_min != null ? `${log.workout_duration_min}m` : "---"}</span>,
  },
  {
    id: "activeCal", label: "Active Cal", width: 70, color: C.workout,
    render: (log) => <span style={{ color: C.workout, opacity: 0.7 }}>{log.active_calories?.toLocaleString() ?? "---"}</span>,
  },
  {
    id: "steps", label: "Steps", width: 60,
    render: (log) => <span style={{ color: "#aaa" }}>{log.steps?.toLocaleString() ?? "---"}</span>,
  },
  {
    id: "sleep", label: "Sleep", width: 50, color: C.sleep,
    render: (log) => <span style={{ color: C.sleep }}>{log.sleep_hours != null ? `${log.sleep_hours.toFixed(1)}h` : "---"}</span>,
  },
  {
    id: "sleepScore", label: "Sleep Score", width: 70, color: C.sleep,
    render: (log) => <span style={{ color: C.sleep, opacity: 0.7 }}>{log.sleep_score ?? "---"}</span>,
  },
  {
    id: "recovery", label: "Recovery", width: 60,
    render: (log) => <span style={{ color: rc(log.readiness_score) }}>{log.readiness_score ?? "---"}</span>,
  },
];

const colMap = Object.fromEntries(COLUMNS.map(c => [c.id, c])) as Record<ColId, ColDef>;

// --- View definitions ---
type ViewId = "all" | "food" | "workouts" | "weight" | "sleep";

interface ViewDef {
  id: ViewId;
  label: string;
  columns: ColId[];
  countFn: (log: DailyLog) => boolean;
}

const VIEWS: ViewDef[] = [
  {
    id: "all",
    label: "All",
    columns: ["date", "weight", "foodCal", "protein", "carbs", "fat", "exerciseCal", "deficit", "steps", "sleep", "sleepScore", "recovery"],
    countFn: () => true,
  },
  {
    id: "food",
    label: "Food",
    columns: ["date", "foodCal", "protein", "carbs", "fat", "deficit"],
    countFn: (l) => l.food_calories != null,
  },
  {
    id: "workouts",
    label: "Workouts",
    columns: ["date", "workoutName", "workoutDuration", "exerciseCal", "activeCal", "steps"],
    countFn: (l) => l.workout_completed === 1 || l.steps != null,
  },
  {
    id: "weight",
    label: "Weight",
    columns: ["date", "weight", "deficit"],
    countFn: (l) => l.weight_lbs != null,
  },
  {
    id: "sleep",
    label: "Sleep",
    columns: ["date", "sleep", "sleepScore", "recovery"],
    countFn: (l) => l.sleep_hours != null,
  },
];

// --- Tab bar ---
function TabBar({ active, views, counts, onSelect }: {
  active: ViewId;
  views: ViewDef[];
  counts: Record<ViewId, number>;
  onSelect: (id: ViewId) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1a1a1a", marginBottom: 0 }}>
      {views.map(v => {
        const isActive = v.id === active;
        return (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: isActive ? "2px solid #fff" : "2px solid transparent",
              color: isActive ? "#fff" : "#555",
              fontSize: 13,
              fontWeight: isActive ? 700 : 500,
              fontFamily: "inherit",
              padding: "8px 16px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "color 0.15s",
            }}
          >
            {v.label}
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: isActive ? "#888" : "#333",
              background: isActive ? "#1a1a1a" : "transparent",
              borderRadius: 6,
              padding: "1px 6px",
              minWidth: 20,
              textAlign: "center",
            }}>
              {counts[v.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// --- Main ---
export function LogView() {
  const { data: logs, isLoading, mutate } = useDailyLogs();
  const [activeView, setActiveView] = useState<ViewId>("all");

  const saveWeight = useCallback(async (day: string, val: string) => {
    await fetch("/api/weight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, weight_lbs: parseFloat(val) }),
    });
    mutate();
  }, [mutate]);

  const saveWater = useCallback(async (day: string, val: string) => {
    await fetch("/api/water", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, water_oz: parseFloat(val) }),
    });
    mutate();
  }, [mutate]);

  if (isLoading) return <div style={{ color: C.muted }}>Loading...</div>;

  const sorted = [...(logs || [])].sort((a, b) => b.day.localeCompare(a.day));
  const view = VIEWS.find(v => v.id === activeView)!;
  const visibleSet = new Set(view.columns);
  const helpers: Helpers = { saveWeight, saveWater };

  // Counts for each tab
  const counts = {} as Record<ViewId, number>;
  for (const v of VIEWS) {
    counts[v.id] = sorted.filter(v.countFn).length;
  }

  // Filter rows for non-"all" views
  const rows = activeView === "all" ? sorted : sorted.filter(view.countFn);

  return (
    <div style={{ overflowX: "auto", margin: "-1.25rem", marginTop: "-1.25rem" }}>
      <style>{`
        .log-row:hover { background: rgba(255,255,255,0.02) !important; }
        .log-row:hover .pencil-icon { opacity: 0.5 !important; }
        .log-row:hover .pencil-icon:hover { opacity: 1 !important; }
      `}</style>

      <div style={{ padding: "0 8px" }}>
        <TabBar active={activeView} views={VIEWS} counts={counts} onSelect={setActiveView} />
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
        <colgroup>
          {COLUMNS.map(col => (
            <col key={col.id} style={{
              width: visibleSet.has(col.id) ? col.width : 0,
              visibility: visibleSet.has(col.id) ? "visible" : "collapse",
            }} />
          ))}
        </colgroup>
        <thead>
          <tr style={{ background: "#0f0f0f" }}>
            {COLUMNS.map(col => {
              const visible = visibleSet.has(col.id);
              return (
                <th key={col.id} style={{
                  padding: visible ? "8px 8px" : 0,
                  textAlign: "left",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: col.color || "#555",
                  fontWeight: 600,
                  borderBottom: visible ? "1px solid #1a1a1a" : "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}>
                  {visible ? col.label : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(log => (
            <tr key={log.day} className="log-row" style={{ borderBottom: "1px solid #111" }}>
              {COLUMNS.map(col => {
                const visible = visibleSet.has(col.id);
                return (
                  <td key={col.id} style={{
                    padding: visible ? "6px 8px" : 0,
                    fontVariantNumeric: "tabular-nums",
                    overflow: "hidden",
                  }}>
                    {visible ? col.render(log, helpers) : null}
                  </td>
                );
              })}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length} style={{ padding: "2rem", textAlign: "center", color: C.muted }}>
                No data yet. Hit Sync to pull today&apos;s data.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
