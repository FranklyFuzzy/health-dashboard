import { NextResponse } from "next/server";
import { localToday } from "@/lib/date";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  const db = getDb();
  const garminConfigured = !!process.env.GARMIN_EMAIL;

  const today = localToday();
  const log = db.prepare("SELECT garmin_synced_at, chrono_synced_at, ladder_synced_at FROM daily_log WHERE day = ?").get(today) as Record<string, unknown> | undefined;

  return NextResponse.json({
    garmin_configured: garminConfigured,
    last_garmin_sync: log?.garmin_synced_at || null,
    last_chrono_sync: log?.chrono_synced_at || null,
    last_ladder_sync: log?.ladder_synced_at || null,
  });
}
