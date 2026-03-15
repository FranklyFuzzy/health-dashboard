import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const db = getDb();
  const day = req.nextUrl.searchParams.get("day");

  if (day) {
    const row = db.prepare("SELECT * FROM daily_log WHERE day = ?").get(day);
    return NextResponse.json(row || null);
  }

  const rows = db.prepare("SELECT * FROM daily_log ORDER BY day DESC LIMIT 90").all();
  return NextResponse.json(rows);
}
