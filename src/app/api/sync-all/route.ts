import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const results: Record<string, unknown> = {};

  // Run all syncs in parallel, don't fail on individual errors
  const [oura, chrono, ladder] = await Promise.allSettled([
    fetch(`${origin}/api/sync-oura`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json()),
    fetch(`${origin}/api/sync-chrono`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json()),
    fetch(`${origin}/api/sync-ladder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "scan" }) }).then((r) => r.json()),
  ]);

  results.oura = oura.status === "fulfilled" ? oura.value : { error: String(oura.reason) };
  results.chrono = chrono.status === "fulfilled" ? chrono.value : { error: String(chrono.reason) };
  results.ladder = ladder.status === "fulfilled" ? ladder.value : { error: String(ladder.reason) };

  return NextResponse.json(results);
}
