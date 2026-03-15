import { NextRequest, NextResponse } from "next/server";
import { ouraGet } from "@/lib/oura";
import { getDb } from "@/lib/db";
import { localToday, localDaysAgo, localTomorrow } from "@/lib/date";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const days = (body as Record<string, unknown>).days as number || 1;

    const today = localToday();
    const tomorrow = localTomorrow();
    const start = localDaysAgo(days);
    // end_date needs to be tomorrow to capture today's sleep data
    const params = { start_date: start, end_date: tomorrow };

    const [activityRes, sleepRes, readinessRes, dailySleepRes, workoutRes] = await Promise.all([
      ouraGet("/v2/usercollection/daily_activity", params),
      ouraGet("/v2/usercollection/sleep", params),
      ouraGet("/v2/usercollection/daily_readiness", params),
      ouraGet("/v2/usercollection/daily_sleep", params),
      ouraGet("/v2/usercollection/workout", params),
    ]);

    // Activity is keyed to the day it happened — use as-is
    const activityByDay: Record<string, Record<string, unknown>> = {};
    for (const a of activityRes.data || []) activityByDay[a.day] = a;

    // Readiness score is keyed to today (wake-up day) — use as-is
    const readinessByDay: Record<string, Record<string, unknown>> = {};
    for (const r of readinessRes.data || []) readinessByDay[r.day] = r;

    // Daily sleep score is keyed to the day you woke up — use as-is
    const dailySleepByDay: Record<string, Record<string, unknown>> = {};
    for (const s of dailySleepRes.data || []) dailySleepByDay[s.day] = s;

    // Sleep periods: Oura keys them to the day field it returns.
    // Just sum by the day Oura gives us — it handles the attribution.
    const sleepHoursByDay: Record<string, number> = {};
    for (const s of sleepRes.data || []) {
      const deep = (s.deep_sleep_duration as number) || 0;
      const light = (s.light_sleep_duration as number) || 0;
      const rem = (s.rem_sleep_duration as number) || 0;
      const hours = (deep + light + rem) / 3600;
      sleepHoursByDay[s.day] = (sleepHoursByDay[s.day] || 0) + hours;
    }

    // Sum Oura logged workout calories per day (treadmill, elliptical, etc)
    const ouraWorkoutCalByDay: Record<string, number> = {};
    for (const w of workoutRes.data || []) {
      const cal = (w.calories as number) || 0;
      ouraWorkoutCalByDay[w.day] = (ouraWorkoutCalByDay[w.day] || 0) + Math.round(cal);
    }

    // For today: use yesterday's activity (today's isn't complete yet)
    const yesterday = localDaysAgo(1);
    if (!activityByDay[today] && activityByDay[yesterday]) {
      activityByDay[today] = activityByDay[yesterday];
    }

    // Collect all days we have data for
    const allDays = new Set<string>();
    for (const key of [
      ...Object.keys(activityByDay),
      ...Object.keys(readinessByDay),
      ...Object.keys(dailySleepByDay),
      ...Object.keys(sleepHoursByDay),
      ...Object.keys(ouraWorkoutCalByDay),
    ]) {
      // Only include days in our requested range
      if (key >= start && key <= today) allDays.add(key);
    }

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO daily_log (day, active_calories, total_calories, steps, sleep_hours, sleep_score, readiness_score, oura_workout_calories, oura_synced_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(day) DO UPDATE SET
        active_calories = CASE WHEN excluded.active_calories IS NOT NULL THEN excluded.active_calories ELSE daily_log.active_calories END,
        total_calories = CASE WHEN excluded.total_calories IS NOT NULL THEN excluded.total_calories ELSE daily_log.total_calories END,
        steps = CASE WHEN excluded.steps IS NOT NULL THEN excluded.steps ELSE daily_log.steps END,
        sleep_hours = CASE WHEN excluded.sleep_hours IS NOT NULL THEN excluded.sleep_hours ELSE daily_log.sleep_hours END,
        sleep_score = CASE WHEN excluded.sleep_score IS NOT NULL THEN excluded.sleep_score ELSE daily_log.sleep_score END,
        readiness_score = CASE WHEN excluded.readiness_score IS NOT NULL THEN excluded.readiness_score ELSE daily_log.readiness_score END,
        oura_workout_calories = CASE WHEN excluded.oura_workout_calories IS NOT NULL THEN excluded.oura_workout_calories ELSE daily_log.oura_workout_calories END,
        oura_synced_at = datetime('now'),
        updated_at = datetime('now')
    `);

    const synced: string[] = [];
    for (const day of allDays) {
      const activity = activityByDay[day];
      const readiness = readinessByDay[day];
      const dailySleep = dailySleepByDay[day];
      const sleepHours = sleepHoursByDay[day] != null ? Math.round(sleepHoursByDay[day] * 10) / 10 : null;

      stmt.run(
        day,
        (activity?.active_calories as number) ?? null,
        (activity?.total_calories as number) ?? null,
        (activity?.steps as number) ?? null,
        sleepHours,
        (dailySleep?.score as number) ?? null,
        (readiness?.score as number) ?? null,
        ouraWorkoutCalByDay[day] ?? null,
      );
      synced.push(day);
    }

    return NextResponse.json({ ok: true, synced: synced.sort() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
