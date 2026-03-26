# Health Dashboard

A local-first personal health dashboard built with Next.js and SQLite. Track weight, food, workouts, sleep, blood work, and more — all in one place.

Ships with pre-built connectors for **Garmin Connect**, **Cronometer**, and **Ladder** workout screenshots, but the architecture is simple enough to add any data source you want.

<img width="1450" height="1147" alt="Screenshot" src="https://github.com/user-attachments/assets/81e3007d-1646-442e-9fab-e7805d06899a" />


## Quick Start

```bash
git clone https://github.com/FranklyFuzzy/health-dashboard.git
cd health-dashboard
npm install
npm run seed    # populate with sample data
npm run dev     # http://localhost:3000
```

The seed script generates 30 days of realistic dummy data so you can explore the dashboard immediately.

## Data Sources

### Garmin Connect
Syncs sleep, activity, readiness (body battery), steps, and workout calories via the `garminconnect` Python library.

1. Set up a Python virtual environment and install dependencies:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install garminconnect python-dotenv
   ```
2. Add your credentials to `.env`:
   ```
   GARMIN_EMAIL=your-email
   GARMIN_PASSWORD=your-password
   ```
3. Run the interactive MFA auth once to populate tokens:
   ```python
   from garminconnect import Garmin
   client = Garmin("your-email", "your-password", prompt_mfa=input)
   client.login()
   client.garth.dump("~/.garminconnect")
   ```
4. After the first login, tokens are stored at `~/.garminconnect/` and auto-refresh — no MFA needed again.
5. Go to Settings in the app and click "Sync Now"

### Cronometer
Syncs food calories and macros (protein/carbs/fat) via [cronometer-export](https://github.com/jrmycanady/cronometer-export).

1. Install the Go binary:
   ```bash
   go install github.com/jrmycanady/cronometer-export@latest
   ```
   Make sure `~/go/bin` is in your `$PATH`.
2. Add your Cronometer credentials to `.env`:
   ```
   CRONOMETER_EMAIL=your-email
   CRONOMETER_PASSWORD=your-password
   ```
3. Hit "Sync Now" in Settings

### Ladder (Workout Screenshots)
Scans workout screenshots from an iCloud folder and extracts duration, calories, and date using OCR.

- **Default folder**: `~/Library/Mobile Documents/com~apple~CloudDocs/Workout Pics`
- **With Gemini Vision** (recommended): Add `GEMINI_API_KEY` to `.env` and set `NEXT_PUBLIC_GEMINI_CONFIGURED=1` for much better accuracy
- **Without Gemini**: Falls back to Tesseract.js OCR

### Blood Work
Upload CSV reports from Rythm (or any CSV with `marker,value,unit,reference_range,status,time` columns).

- Click the **+** button on the Blood Work page to upload CSVs
- Or bulk import: `npx tsx scripts/import-bloodwork.ts /path/to/csv/folder`

## Adding Your Own Sources

The architecture for each data source is the same:

```
Scraper/Parser → API Route → SQLite upsert → SWR hook → Component
```

For example, to add MyFitnessPal, Whoop, Apple Health, or any other source:

1. Create a scraper/parser in `src/lib/scrapers/`
2. Create an API route in `src/app/api/` that calls it and upserts into `daily_log`
3. The existing dashboard components will pick up the data automatically via SWR

This project was built with [Claude Code](https://claude.ai/claude-code) — you can use it to add new integrations by describing what you want.

## Automated Daily Sync

You can automate daily syncing with a cron job. A helper script is included:

```bash
# Make it executable (already done if you cloned fresh)
chmod +x scripts/sync-cron.sh

# Add to crontab — runs daily at 3am (yesterday's data is fully finalized by then)
crontab -e
# Add this line:
0 3 * * * /path/to/health-dashboard/scripts/sync-cron.sh
```

The app must be running on `localhost:3000` for the cron job to work.

## Customizing Targets

Edit `src/lib/constants.ts` to change your daily nutrition goals:

```ts
export const TARGETS = {
  calories: 2000,      // daily calorie target (kcal)
  protein_g: 170,      // protein (grams)
  carbs_g: 185,        // carbs (grams)
  fat_g: 75,           // fat (grams)
  workout_min: 60,     // workout duration (minutes)
};
```

The dashboard Calories card, macro bars, and Protein chart all use these values.

## Stack

- **Next.js 16** with App Router
- **React 19**
- **SQLite** via better-sqlite3 (local file, no server needed)
- **SWR** for data fetching
- **Tailwind CSS v4**

## Environment Variables

Copy `.env.example` to `.env` and fill in the values you need:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GARMIN_EMAIL` | For Garmin sync | Garmin Connect login email |
| `GARMIN_PASSWORD` | For Garmin sync | Garmin Connect login password |
| `CRONOMETER_EMAIL` | For Cronometer sync | Cronometer login email |
| `CRONOMETER_PASSWORD` | For Cronometer sync | Cronometer login password |
| `GEMINI_API_KEY` | For Ladder OCR | Google AI Studio API key |
| `NEXT_PUBLIC_GEMINI_CONFIGURED` | For Ladder OCR | Set to `1` when Gemini key is added |

## License

MIT
