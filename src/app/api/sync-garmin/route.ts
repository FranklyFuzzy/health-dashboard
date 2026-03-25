import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const days = (body as Record<string, unknown>).days as number || 1;

    const scriptPath = path.join(process.cwd(), "scripts", "garmin-sync.py");
    const pythonPath = path.join(process.cwd(), "venv", "bin", "python3");
    const stdout = execSync(`"${pythonPath}" "${scriptPath}" --days ${days}`, {
      timeout: 60000,
      encoding: "utf-8",
    });

    const data = JSON.parse(stdout) as Array<{
      day: string;
      active_calories: number;
      total_calories: number;
      steps: number;
      sleep_hours: number;
      sleep_score: number;
      readiness_score: number;
      garmin_workout_calories: number;
      garmin_workout_duration_min?: number;
      garmin_workout_name?: string | null;
    }>;

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO daily_log (day, active_calories, total_calories, steps, sleep_hours, sleep_score, readiness_score, garmin_workout_calories, workout_completed, workout_duration_min, workout_name, workout_calories, garmin_synced_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(day) DO UPDATE SET
        active_calories = CASE WHEN excluded.active_calories IS NOT NULL THEN excluded.active_calories ELSE daily_log.active_calories END,
        total_calories = CASE WHEN excluded.total_calories IS NOT NULL THEN excluded.total_calories ELSE daily_log.total_calories END,
        steps = CASE WHEN excluded.steps IS NOT NULL THEN excluded.steps ELSE daily_log.steps END,
        sleep_hours = CASE WHEN excluded.sleep_hours IS NOT NULL THEN excluded.sleep_hours ELSE daily_log.sleep_hours END,
        sleep_score = CASE WHEN excluded.sleep_score IS NOT NULL THEN excluded.sleep_score ELSE daily_log.sleep_score END,
        readiness_score = CASE WHEN excluded.readiness_score IS NOT NULL THEN excluded.readiness_score ELSE daily_log.readiness_score END,
        garmin_workout_calories = CASE WHEN excluded.garmin_workout_calories IS NOT NULL THEN excluded.garmin_workout_calories ELSE daily_log.garmin_workout_calories END,
        workout_completed = CASE WHEN daily_log.ladder_synced_at IS NOT NULL THEN daily_log.workout_completed ELSE excluded.workout_completed END,
        workout_duration_min = CASE WHEN daily_log.ladder_synced_at IS NOT NULL THEN daily_log.workout_duration_min ELSE excluded.workout_duration_min END,
        workout_name = CASE WHEN daily_log.ladder_synced_at IS NOT NULL THEN daily_log.workout_name ELSE excluded.workout_name END,
        workout_calories = CASE WHEN daily_log.ladder_synced_at IS NOT NULL THEN daily_log.workout_calories ELSE excluded.workout_calories END,
        garmin_synced_at = datetime('now'),
        updated_at = datetime('now')
    `);

    const synced: string[] = [];
    for (const row of data) {
      const hasWorkout = (row.garmin_workout_calories || 0) > 0;
      stmt.run(
        row.day,
        row.active_calories || null,
        row.total_calories || null,
        row.steps || null,
        row.sleep_hours || null,
        row.sleep_score || null,
        row.readiness_score || null,
        row.garmin_workout_calories || null,
        hasWorkout ? 1 : 0,
        hasWorkout ? (row.garmin_workout_duration_min || null) : null,
        hasWorkout ? (row.garmin_workout_name || null) : null,
        hasWorkout ? (row.garmin_workout_calories || null) : null,
      );
      synced.push(row.day);
    }

    return NextResponse.json({ ok: true, synced: synced.sort() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
