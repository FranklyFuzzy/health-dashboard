import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";

const LADDER_FOLDER = path.join(
  process.env.HOME || "",
  "Library/Mobile Documents/com~apple~CloudDocs/Workout Pics"
);

export interface LadderData {
  workout_completed: boolean;
  workout_calories: number | null;
  workout_duration_min: number | null;
  workout_name: string | null;
  avg_hr: number | null;
  date: string | null;
}

const GEMINI_PROMPT = `Extract workout data from this Ladder app screenshot. The overlay shows:
- Duration (MM:SS format labeled "Minutes")
- Average heart rate (labeled "Avg HR")
- Calories burned (labeled "Calories")
- Date (on the right side, rotated, format like "# LADDER · M/D/YYYY")
- Ladder score (number inside a circular badge)

Return ONLY a JSON object with these fields (use null if not visible):
{
  "duration_min": <number, total minutes rounded>,
  "calories": <number>,
  "avg_hr": <number>,
  "date": "<YYYY-MM-DD>",
  "ladder_score": <number>
}`;

async function extractWithGemini(imagePath: string): Promise<LadderData | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const imageBytes = fs.readFileSync(imagePath);
  const base64 = imageBytes.toString("base64");
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : ext === ".heic" ? "image/heic" : "image/jpeg";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: GEMINI_PROMPT },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 256,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  // Extract JSON from response (may be wrapped in ```json blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      workout_completed: true,
      workout_calories: parsed.calories ?? null,
      workout_duration_min: parsed.duration_min ?? null,
      workout_name: "Ladder",
      avg_hr: parsed.avg_hr ?? null,
      date: parsed.date ?? null,
    };
  } catch {
    return null;
  }
}

// Fallback: try Tesseract if Gemini is not configured
async function extractWithTesseract(imagePath: string): Promise<LadderData | null> {
  let Tesseract;
  try {
    Tesseract = await import("tesseract.js");
  } catch {
    return null;
  }

  const { data: { text } } = await Tesseract.recognize(imagePath, "eng");
  return parseLadderText(text);
}

function parseLadderText(text: string): LadderData | null {
  const calMatch = text.match(/(\d{2,4})\s*[^\n]{0,10}\n?\s*Calorie/i);
  const durMatch = text.match(/(\d{1,2}):(\d{2}):(\d{2})/) || text.match(/(\d{1,3}):(\d{2})\s*[^\n]{0,10}\n?\s*Minut/i);
  const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);

  if (!calMatch && !durMatch) return null;

  let durationMin: number | null = null;
  if (durMatch) {
    if (durMatch[3] && durMatch[0].match(/\d+:\d+:\d+/)) {
      durationMin = parseInt(durMatch[1]) * 60 + parseInt(durMatch[2]);
    } else {
      durationMin = parseInt(durMatch[1]) + (parseInt(durMatch[2]) > 30 ? 1 : 0);
    }
  }

  let dateStr: string | null = null;
  if (dateMatch) {
    const month = dateMatch[1].padStart(2, "0");
    const day = dateMatch[2].padStart(2, "0");
    dateStr = `${dateMatch[3]}-${month}-${day}`;
  }

  return {
    workout_completed: true,
    workout_calories: calMatch ? parseInt(calMatch[1]) : null,
    workout_duration_min: durationMin,
    workout_name: "Ladder",
    avg_hr: null,
    date: dateStr,
  };
}

export async function processLadderScreenshots(): Promise<{ processed: string[]; errors: string[] }> {
  const processed: string[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(LADDER_FOLDER)) {
    return { processed, errors: ["Folder not found: " + LADDER_FOLDER] };
  }

  const files = fs.readdirSync(LADDER_FOLDER)
    .filter(f => /\.(png|jpg|jpeg|heic)$/i.test(f))
    .sort();

  if (files.length === 0) {
    return { processed, errors: [] };
  }

  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS ladder_processed (
      filename TEXT PRIMARY KEY,
      processed_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const alreadyProcessed = new Set(
    (db.prepare("SELECT filename FROM ladder_processed").all() as { filename: string }[])
      .map(r => r.filename)
  );

  const useGemini = !!process.env.GEMINI_API_KEY;

  for (const file of files) {
    if (alreadyProcessed.has(file)) continue;

    const filePath = path.join(LADDER_FOLDER, file);

    try {
      const data = useGemini
        ? await extractWithGemini(filePath)
        : await extractWithTesseract(filePath);

      if (data) {
        let day = data.date;
        if (!day) {
          const stat = fs.statSync(filePath);
          day = stat.mtime.toISOString().slice(0, 10);
        }

        db.prepare(`
          INSERT INTO daily_log (day, workout_completed, workout_calories, workout_duration_min, workout_name, ladder_synced_at, updated_at)
          VALUES (?, 1, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(day) DO UPDATE SET
            workout_completed = 1,
            workout_calories = COALESCE(excluded.workout_calories, daily_log.workout_calories),
            workout_duration_min = COALESCE(excluded.workout_duration_min, daily_log.workout_duration_min),
            workout_name = COALESCE(excluded.workout_name, daily_log.workout_name),
            ladder_synced_at = datetime('now'),
            updated_at = datetime('now')
        `).run(day, data.workout_calories, data.workout_duration_min, data.workout_name);

        processed.push(`${file} → ${day}: ${data.workout_duration_min}min, ${data.workout_calories}cal`);
      } else {
        errors.push(`${file}: no Ladder data found`);
      }

      db.prepare("INSERT OR IGNORE INTO ladder_processed (filename) VALUES (?)").run(file);
    } catch (e) {
      errors.push(`${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { processed, errors };
}
