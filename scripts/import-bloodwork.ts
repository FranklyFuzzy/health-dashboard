/**
 * Import all Rythm CSV blood work reports into the database.
 * Usage: npx tsx scripts/import-bloodwork.ts [directory]
 * Default directory: ~/Downloads/rythm-all-csv-reports-cohen
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "health.db");
const DEFAULT_DIR = path.join(process.env.HOME || "~", "Downloads/rythm-all-csv-reports-cohen");

const dir = process.argv[2] || DEFAULT_DIR;

if (!fs.existsSync(dir)) {
  console.error(`Directory not found: ${dir}`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Ensure table exists
db.exec(`
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
  )
`);

const stmt = db.prepare(`
  INSERT INTO blood_results (marker, value, unit, reference_low, reference_high, status, test_date)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(marker, test_date) DO UPDATE SET
    value = excluded.value,
    unit = excluded.unit,
    reference_low = excluded.reference_low,
    reference_high = excluded.reference_high,
    status = excluded.status
`);

const files = fs.readdirSync(dir).filter(f => f.endsWith(".csv")).sort();
let totalImported = 0;

const importAll = db.transaction(() => {
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf-8");
    const lines = content.trim().split("\n");
    let count = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = parseCsvLine(line);
      if (parts.length < 6) continue;

      const [marker, valueStr, unit, refRange, status, testDate] = parts;
      const value = parseFloat(valueStr);
      if (isNaN(value)) continue;

      let refLow: number | null = null;
      let refHigh: number | null = null;
      const rangeMatch = refRange.match(/([\d.]+)\s*-\s*([\d.]+)/);
      if (rangeMatch) {
        refLow = parseFloat(rangeMatch[1]);
        refHigh = parseFloat(rangeMatch[2]);
      }

      stmt.run(marker, value, unit, refLow, refHigh, status, testDate);
      count++;
    }

    console.log(`  ${file}: ${count} markers`);
    totalImported += count;
  }
});

importAll();
console.log(`\nImported ${totalImported} results from ${files.length} files`);
db.close();

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}
