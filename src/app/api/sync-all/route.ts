import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const results: Record<string, unknown> = {};

  let days = 1;
  try {
    const body = await req.json();
    if (body.days && Number.isInteger(body.days) && body.days > 0) {
      days = body.days;
    }
  } catch {
    // no body or invalid JSON — default to 1 day
  }

  // Run all syncs in parallel, don't fail on individual errors
  const [garmin, chrono, ladder] = await Promise.allSettled([
    fetch(`${origin}/api/sync-garmin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }) }).then((r) => r.json()),
    fetch(`${origin}/api/sync-chrono`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }) }).then((r) => r.json()),
    fetch(`${origin}/api/sync-ladder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "scan" }) }).then((r) => r.json()),
  ]);

  results.garmin = garmin.status === "fulfilled" ? garmin.value : { error: String(garmin.reason) };
  results.chrono = chrono.status === "fulfilled" ? chrono.value : { error: String(chrono.reason) };
  results.ladder = ladder.status === "fulfilled" ? ladder.value : { error: String(ladder.reason) };

  return NextResponse.json(results);
}
