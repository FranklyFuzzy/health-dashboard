import { NextResponse } from "next/server";
import { execSync } from "child_process";
import os from "os";
import path from "path";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const days = (body as Record<string, unknown>).days as number || 1;

    const email = process.env.CRONOMETER_EMAIL;
    const password = process.env.CRONOMETER_PASSWORD;
    if (!email || !password) {
      return NextResponse.json({ error: "CRONOMETER_EMAIL and CRONOMETER_PASSWORD must be set" }, { status: 500 });
    }

    const goBin = path.join(os.homedir(), "go", "bin");
    const env = { ...process.env, PATH: `${goBin}:${process.env.PATH ?? ""}` };

    const stdout = execSync(
      `cronometer-export -u "${email}" -p "${password}" -t daily-nutrition -s "-${days}d" -e "-0d"`,
      { timeout: 60000, encoding: "utf-8", env },
    );

    const lines = stdout.trim().split("\n");
    if (lines.length < 2) {
      return NextResponse.json({ ok: true, synced: [], message: "No data returned" });
    }

    const header = lines[0].split(",");
    const idx = {
      date: header.indexOf("Date"),
      energy: header.indexOf("Energy (kcal)"),
      protein: header.indexOf("Protein (g)"),
      carbs: header.indexOf("Net Carbs (g)"),
      fat: header.indexOf("Fat (g)"),
    };

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO daily_log (day, food_calories, protein_g, carbs_g, fat_g, chrono_synced_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(day) DO UPDATE SET
        food_calories = COALESCE(excluded.food_calories, daily_log.food_calories),
        protein_g = COALESCE(excluded.protein_g, daily_log.protein_g),
        carbs_g = COALESCE(excluded.carbs_g, daily_log.carbs_g),
        fat_g = COALESCE(excluded.fat_g, daily_log.fat_g),
        chrono_synced_at = datetime('now'),
        updated_at = datetime('now')
    `);

    const synced: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const day = cols[idx.date];
      if (!day) continue;

      const energy = idx.energy >= 0 ? parseFloat(cols[idx.energy]) : null;
      const protein = idx.protein >= 0 ? parseFloat(cols[idx.protein]) : null;
      const carbs = idx.carbs >= 0 ? parseFloat(cols[idx.carbs]) : null;
      const fat = idx.fat >= 0 ? parseFloat(cols[idx.fat]) : null;

      const calories = energy != null && !isNaN(energy) ? Math.round(energy) : null;
      if (calories == null) continue;

      stmt.run(
        day,
        calories,
        protein != null && !isNaN(protein) ? Math.round(protein * 10) / 10 : null,
        carbs != null && !isNaN(carbs) ? Math.round(carbs * 10) / 10 : null,
        fat != null && !isNaN(fat) ? Math.round(fat * 10) / 10 : null,
      );
      synced.push(day);
    }

    return NextResponse.json({ ok: true, synced: synced.sort() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
