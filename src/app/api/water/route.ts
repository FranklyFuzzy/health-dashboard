import { localToday } from "@/lib/date";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  const waterOz = parseFloat(body.water_oz);
  if (isNaN(waterOz)) {
    return NextResponse.json({ error: "Invalid water amount" }, { status: 400 });
  }

  const day = body.day || localToday();
  const db = getDb();

  db.prepare(`
    INSERT INTO daily_log (day, water_oz, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(day) DO UPDATE SET
      water_oz = excluded.water_oz,
      updated_at = datetime('now')
  `).run(day, waterOz);

  return NextResponse.json({ ok: true, day, water_oz: waterOz });
}
