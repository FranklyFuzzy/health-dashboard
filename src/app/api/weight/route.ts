import { localToday } from "@/lib/date";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM weight_log ORDER BY day DESC LIMIT 90").all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const weightLbs = parseFloat(body.weight_lbs);
  if (isNaN(weightLbs)) {
    return NextResponse.json({ error: "Invalid weight" }, { status: 400 });
  }

  const day = body.day || localToday();
  const db = getDb();

  // Upsert weight history (overwrite if same day)
  db.prepare("DELETE FROM weight_log WHERE day = ?").run(day);
  db.prepare("INSERT INTO weight_log (day, weight_lbs) VALUES (?, ?)").run(day, weightLbs);

  // Update daily log
  db.prepare(`
    INSERT INTO daily_log (day, weight_lbs, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(day) DO UPDATE SET
      weight_lbs = excluded.weight_lbs,
      updated_at = datetime('now')
  `).run(day, weightLbs);

  return NextResponse.json({ ok: true, day, weight_lbs: weightLbs });
}
