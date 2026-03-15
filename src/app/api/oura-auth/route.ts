import { localToday } from "@/lib/date";
import { NextRequest, NextResponse } from "next/server";
import { getOuraAuthUrl, getOuraClientId } from "@/lib/oura";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  // If this is a browser navigation (Accept: text/html), redirect to Oura OAuth
  const accept = req.headers.get("accept") || "";
  if (accept.includes("text/html")) {
    const redirectUri = `${req.nextUrl.origin}/api/oura-callback`;
    const url = getOuraAuthUrl(redirectUri);
    return NextResponse.redirect(url);
  }

  // Otherwise return status JSON for SWR
  const db = getDb();
  const auth = db.prepare("SELECT * FROM oura_auth WHERE id = 1").get() as Record<string, unknown> | undefined;
  const ouraConnected = !!auth?.access_token;

  // Get last sync times from today's log
  const today = localToday();
  const log = db.prepare("SELECT oura_synced_at, chrono_synced_at, ladder_synced_at FROM daily_log WHERE day = ?").get(today) as Record<string, unknown> | undefined;

  return NextResponse.json({
    oura_connected: ouraConnected,
    oura_client_id: getOuraClientId() ? true : false,
    last_oura_sync: log?.oura_synced_at || null,
    last_chrono_sync: log?.chrono_synced_at || null,
    last_ladder_sync: log?.ladder_synced_at || null,
  });
}
