# Health Dashboard

A local-first personal health dashboard built with Next.js and SQLite. Track weight, food, workouts, sleep, blood work, and more — all in one place.

Ships with pre-built connectors for **Oura Ring**, **Cronometer**, and **Ladder** workout screenshots, but the architecture is simple enough to add any data source you want.

## Quick Start

```bash
git clone https://github.com/alexcohennyc/health-dashboard.git
cd health-dashboard
npm install
npm run seed    # populate with sample data
npm run dev     # http://localhost:3000
```

The seed script generates 30 days of realistic dummy data so you can explore the dashboard immediately.

## Data Sources

### Oura Ring
Syncs sleep, activity, readiness scores, and steps.

1. Create a developer account at [cloud.ouraring.com](https://cloud.ouraring.com/v2/docs)
2. Create a new application with redirect URI `http://localhost:3000/api/oura-callback`
3. Add your credentials to `.env`:
   ```
   OURA_CLIENT_ID=your-client-id
   OURA_CLIENT_SECRET=your-client-secret
   ```
4. Go to Settings in the app and click "Connect Oura"

### Cronometer
Syncs food calories, macros (protein/carbs/fat), and water intake via browser automation.

1. Add your Cronometer credentials to `.env`:
   ```
   CHRONO_EMAIL=your-email
   CHRONO_PASS=your-password
   ```
2. Install Playwright browsers: `npx playwright install chromium`
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
| `OURA_CLIENT_ID` | For Oura sync | Oura developer app client ID |
| `OURA_CLIENT_SECRET` | For Oura sync | Oura developer app client secret |
| `CHRONO_EMAIL` | For Cronometer sync | Cronometer login email |
| `CHRONO_PASS` | For Cronometer sync | Cronometer login password |
| `GEMINI_API_KEY` | For Ladder OCR | Google AI Studio API key |
| `NEXT_PUBLIC_GEMINI_CONFIGURED` | For Ladder OCR | Set to `1` when Gemini key is added |

## License

MIT
