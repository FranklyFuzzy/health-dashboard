/**
 * Seed the database with realistic dummy data.
 * Usage: npm run seed
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "health.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_log (
    day TEXT PRIMARY KEY,
    active_calories INTEGER,
    total_calories INTEGER,
    steps INTEGER,
    sleep_hours REAL,
    sleep_score INTEGER,
    readiness_score INTEGER,
    food_calories INTEGER,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    workout_completed INTEGER DEFAULT 0,
    workout_calories INTEGER,
    workout_duration_min INTEGER,
    workout_name TEXT,
    garmin_workout_calories INTEGER,
    weight_lbs REAL,
    water_oz REAL,
    garmin_synced_at TEXT,
    chrono_synced_at TEXT,
    ladder_synced_at TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS weight_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    weight_lbs REAL NOT NULL,
    logged_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS blood_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marker TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    reference_low REAL,
    reference_high REAL,
    status TEXT,
    test_date TEXT NOT NULL,
    uploaded_at TEXT DEFAULT (datetime('now')),
    UNIQUE(marker, test_date)
  );
`);

// --- Helpers ---
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
function randInt(min: number, max: number): number {
  return Math.round(rand(min, max));
}
function dayStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// --- Seed daily_log + weight_log ---
const DAYS = 30;
let baseWeight = 182;

const dailyStmt = db.prepare(`
  INSERT OR REPLACE INTO daily_log (
    day, active_calories, total_calories, steps, sleep_hours, sleep_score,
    readiness_score, food_calories, protein_g, carbs_g, fat_g,
    workout_completed, workout_calories, workout_duration_min, workout_name,
    weight_lbs, water_oz, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

const weightStmt = db.prepare(`
  INSERT OR REPLACE INTO weight_log (day, weight_lbs) VALUES (?, ?)
`);

const workoutDays = new Set<number>();
// ~5 workouts per week
for (let i = 0; i < DAYS; i++) {
  const dayOfWeek = new Date(Date.now() - i * 86400000).getDay();
  // Rest on random 2 days per week, usually Sun(0) and one other
  if (dayOfWeek === 0 || (dayOfWeek === 3 && Math.random() > 0.5)) continue;
  if (Math.random() > 0.15) workoutDays.add(i);
}

const insertAll = db.transaction(() => {
  for (let i = DAYS - 1; i >= 0; i--) {
    const day = dayStr(i);
    const isWorkout = workoutDays.has(i);

    // Weight drifts slowly
    baseWeight += rand(-0.3, 0.4);
    const weight = Math.round(baseWeight * 10) / 10;

    const activeCal = isWorkout ? randInt(300, 600) : randInt(150, 350);
    const totalCal = activeCal + randInt(1500, 1800);
    const steps = randInt(4000, 12000);
    const sleepHours = Math.round(rand(5.8, 8.5) * 10) / 10;
    const sleepScore = randInt(55, 92);
    const readiness = randInt(50, 95);
    const foodCal = randInt(1500, 2300);
    const protein = Math.round(rand(100, 200) * 10) / 10;
    const carbs = Math.round(rand(80, 250) * 10) / 10;
    const fat = Math.round(rand(40, 90) * 10) / 10;
    const water = randInt(30, 130);

    const workoutCal = isWorkout ? randInt(150, 380) : null;
    const workoutMin = isWorkout ? randInt(30, 75) : null;
    const workoutName = isWorkout ? ["Ladder", "Ladder", "Ladder", "Run", "HIIT"][randInt(0, 4)] : null;

    dailyStmt.run(
      day, activeCal, totalCal, steps, sleepHours, sleepScore,
      readiness, foodCal, protein, carbs, fat,
      isWorkout ? 1 : 0, workoutCal, workoutMin, workoutName,
      weight, water,
    );

    weightStmt.run(day, weight);
  }
});

insertAll();
console.log(`Seeded ${DAYS} days of daily log + weight data`);

// --- Seed blood_results ---
const BLOOD_DATES = [
  dayStr(120),  // ~4 months ago
  dayStr(80),   // ~2.5 months ago
  dayStr(40),   // ~6 weeks ago
  dayStr(7),    // last week
];

interface MarkerDef {
  marker: string;
  unit: string;
  refLow: number;
  refHigh: number;
  baseValue: number;
  drift: number;
}

const MARKERS: MarkerDef[] = [
  { marker: "Total Testosterone", unit: "ng/dL", refLow: 200, refHigh: 800, baseValue: 650, drift: 80 },
  { marker: "Free Testosterone", unit: "pg/mL", refLow: 46, refHigh: 224, baseValue: 140, drift: 30 },
  { marker: "Estrogen", unit: "pg/mL", refLow: 15, refHigh: 32, baseValue: 25, drift: 8 },
  { marker: "SHBG", unit: "nmol/L", refLow: 13.3, refHigh: 89.5, baseValue: 30, drift: 8 },
  { marker: "Thyroid Stimulating Hormone", unit: "uIU/mL", refLow: 0.45, refHigh: 4.5, baseValue: 1.8, drift: 0.6 },
  { marker: "Free T3", unit: "pg/mL", refLow: 2, refHigh: 4.4, baseValue: 3.1, drift: 0.4 },
  { marker: "Total Cholesterol", unit: "mg/dL", refLow: 100, refHigh: 240, baseValue: 170, drift: 20 },
  { marker: "LDL Cholesterol", unit: "mg/dL", refLow: 40, refHigh: 150, baseValue: 100, drift: 15 },
  { marker: "HDL Cholesterol", unit: "mg/dL", refLow: 40, refHigh: 120, baseValue: 52, drift: 8 },
  { marker: "Triglycerides", unit: "mg/dL", refLow: 0, refHigh: 149, baseValue: 65, drift: 20 },
  { marker: "ApoB", unit: "mg/dL", refLow: 0, refHigh: 90, baseValue: 78, drift: 10 },
  { marker: "hs-CRP (High-Sensitivity C-Reactive Protein)", unit: "mg/L", refLow: 0, refHigh: 3.0, baseValue: 1.2, drift: 0.6 },
  { marker: "Creatinine", unit: "mg/dL", refLow: 0.6, refHigh: 1.2, baseValue: 0.9, drift: 0.1 },
  { marker: "Albumin", unit: "g/dL", refLow: 3.5, refHigh: 5.2, baseValue: 4.6, drift: 0.3 },
  { marker: "Vitamin D", unit: "ng/mL", refLow: 30, refHigh: 80, baseValue: 38, drift: 6 },
  { marker: "Ferritin", unit: "ng/mL", refLow: 29, refHigh: 575, baseValue: 45, drift: 10 },
  { marker: "LDL/ApoB Ratio", unit: "pct", refLow: 1.2, refHigh: 1.4, baseValue: 1.28, drift: 0.08 },
  { marker: "Total Cholesterol/HDL Ratio", unit: "pct", refLow: 3, refHigh: 5.1, baseValue: 3.3, drift: 0.4 },
  { marker: "Triglycerides/HDL Ratio", unit: "pct", refLow: 1.25, refHigh: 2.5, baseValue: 1.3, drift: 0.3 },
  { marker: "Remnant Cholesterol", unit: "mg/dL", refLow: 20, refHigh: 24, baseValue: 14, drift: 4 },
];

const bloodStmt = db.prepare(`
  INSERT OR REPLACE INTO blood_results (marker, value, unit, reference_low, reference_high, status, test_date)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertBlood = db.transaction(() => {
  for (const date of BLOOD_DATES) {
    for (const m of MARKERS) {
      const value = Math.round((m.baseValue + rand(-m.drift, m.drift)) * 100) / 100;
      let status = "average";
      if (value >= m.refLow && value <= m.refHigh) {
        // Within range — check if in the "optimal" zone (middle 60%)
        const rangeSize = m.refHigh - m.refLow;
        const optLow = m.refLow + rangeSize * 0.2;
        const optHigh = m.refHigh - rangeSize * 0.2;
        if (value >= optLow && value <= optHigh) status = "optimal";
      } else {
        status = "outOfRange";
      }
      bloodStmt.run(m.marker, value, m.unit, m.refLow, m.refHigh, status, date);
    }
  }
});

insertBlood();
console.log(`Seeded ${MARKERS.length} blood markers across ${BLOOD_DATES.length} test dates`);

db.close();
console.log("\nDone! Run `npm run dev` to start the dashboard.");
