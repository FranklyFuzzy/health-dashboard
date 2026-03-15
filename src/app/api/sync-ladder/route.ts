import { localToday } from "@/lib/date";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { processLadderScreenshots } from "@/lib/scrapers/ladder";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { mode } = body as Record<string, unknown>;

    if (mode === "scan" || mode === "rescan") {
      // Rescan: clear the processed list so all files are reprocessed
      if (mode === "rescan") {
        const db = getDb();
        db.exec("DELETE FROM ladder_processed");
      }

      const result = await processLadderScreenshots();
      return NextResponse.json({ ok: true, ...result });
    }

    // Manual entry
    const {
      workout_completed,
      workout_calories,
      workout_duration_min,
      workout_name,
    } = body as Record<string, unknown>;

    const today = localToday();
    const db = getDb();

    db.prepare(`
      INSERT INTO daily_log (day, workout_completed, workout_calories, workout_duration_min, workout_name, ladder_synced_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(day) DO UPDATE SET
        workout_completed = excluded.workout_completed,
        workout_calories = excluded.workout_calories,
        workout_duration_min = excluded.workout_duration_min,
        workout_name = excluded.workout_name,
        ladder_synced_at = datetime('now'),
        updated_at = datetime('now')
    `).run(
      today,
      workout_completed ? 1 : 0,
      workout_calories ?? null,
      workout_duration_min ?? null,
      workout_name ?? null,
    );

    return NextResponse.json({ ok: true, day: today });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
