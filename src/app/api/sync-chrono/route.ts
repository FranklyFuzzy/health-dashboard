import { localToday } from "@/lib/date";
import { NextResponse } from "next/server";
import { scrapeChronometer, scrapeChrometerMultipleDays } from "@/lib/scrapers/chronometer";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const days = (body as Record<string, unknown>).days as number || 1;

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO daily_log (day, food_calories, protein_g, carbs_g, fat_g, water_oz, chrono_synced_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(day) DO UPDATE SET
        food_calories = COALESCE(excluded.food_calories, daily_log.food_calories),
        protein_g = COALESCE(excluded.protein_g, daily_log.protein_g),
        carbs_g = COALESCE(excluded.carbs_g, daily_log.carbs_g),
        fat_g = COALESCE(excluded.fat_g, daily_log.fat_g),
        water_oz = COALESCE(excluded.water_oz, daily_log.water_oz),
        chrono_synced_at = datetime('now'),
        updated_at = datetime('now')
    `);

    if (days === 1) {
      const data = await scrapeChronometer();
      const today = localToday();
      stmt.run(today, data.food_calories, data.protein_g, data.carbs_g, data.fat_g, data.water_oz);
      return NextResponse.json({ ok: true, synced: [today], data });
    }

    const results = await scrapeChrometerMultipleDays(days);
    const synced: string[] = [];
    for (const { day, data } of results) {
      if (data.food_calories != null) {
        stmt.run(day, data.food_calories, data.protein_g, data.carbs_g, data.fat_g, data.water_oz);
        synced.push(day);
      }
    }

    return NextResponse.json({ ok: true, synced, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
