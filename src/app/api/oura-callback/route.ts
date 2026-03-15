import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/oura";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/oura-callback`;
    await exchangeCode(code, redirectUri);
    return NextResponse.redirect(new URL("/#settings", req.nextUrl.origin));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
