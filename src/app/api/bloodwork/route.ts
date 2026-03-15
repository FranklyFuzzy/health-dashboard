import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM blood_results ORDER BY test_date DESC, marker ASC").all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { csv } = body as { csv: string };
  if (!csv) {
    return NextResponse.json({ error: "No CSV data provided" }, { status: 400 });
  }

  const db = getDb();
  const lines = csv.trim().split("\n");
  // Skip header
  const header = lines[0];
  if (!header.startsWith("marker,")) {
    return NextResponse.json({ error: "Invalid CSV format" }, { status: 400 });
  }

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

  let imported = 0;
  const insertMany = db.transaction(() => {
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV — handle commas inside quoted fields
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
      imported++;
    }
  });

  insertMany();

  return NextResponse.json({ ok: true, imported });
}

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
