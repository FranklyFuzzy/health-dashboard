import { chromium, type Page } from "playwright";

export interface ChronoData {
  food_calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  water_oz: number | null;
}

export interface ChronoDayResult {
  day: string;
  data: ChronoData;
}

async function login(page: Page): Promise<void> {
  const email = process.env.CHRONO_EMAIL;
  const password = process.env.CHRONO_PASS;
  if (!email || !password) throw new Error("Chronometer credentials not configured");

  await page.goto("https://cronometer.com/login/", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2000);

  await page.fill('input[type="email"], input[name="email"], input[placeholder*="mail"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("LOG IN"), button:has-text("Log In"), button[type="submit"]');
  await page.waitForTimeout(5000);

  // Navigate to diary
  await page.goto("https://cronometer.com/#diary", { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const diaryLink = page.locator('a:has-text("Diary"), [href*="diary"]').first();
  if (await diaryLink.isVisible().catch(() => false)) {
    await diaryLink.click();
    await page.waitForTimeout(3000);
  }
}

async function scrapeDiaryPage(page: Page): Promise<ChronoData> {
  const bodyText = await page.evaluate(() => document.body.innerText);
  return parseNutritionFromText(bodyText);
}

async function goBackOneDay(page: Page): Promise<void> {
  // Cronometer sidebar has a left chevron with class "diary-date-previous"
  const prevBtn = page.locator(".diary-date-previous, .icon-chevron-left.diary-date-previous").first();
  if (await prevBtn.isVisible().catch(() => false)) {
    await prevBtn.click();
    await page.waitForTimeout(2500);
    return;
  }

  // Fallback: try the icon directly
  const icon = page.locator("i.icon-chevron-left").first();
  if (await icon.isVisible().catch(() => false)) {
    await icon.click();
    await page.waitForTimeout(2500);
  }
}

export async function scrapeChronometer(): Promise<ChronoData> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  try {
    await login(page);
    return await scrapeDiaryPage(page);
  } finally {
    await browser.close();
  }
}

export async function scrapeChrometerMultipleDays(days: number): Promise<ChronoDayResult[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  const results: ChronoDayResult[] = [];

  try {
    await login(page);

    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 86400000);
      const dayStr = date.toISOString().slice(0, 10);

      if (i > 0) {
        await goBackOneDay(page);
      }

      const data = await scrapeDiaryPage(page);
      results.push({ day: dayStr, data });
    }

    return results;
  } finally {
    await browser.close();
  }
}

function parseNutritionFromText(text: string): ChronoData {
  // Cronometer's diary shows the Energy Summary section with lines like:
  // "Energy\n619.9 (526.9 net) / 1972 kcal" and "Protein\n53.0 / 185.0 g"
  // Also meal headers: "Breakfast\n620 kcal • 53 g protein • 19 g carbs • 36 g fat"

  const result: ChronoData = {
    food_calories: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    water_oz: null,
  };

  // Try Energy Summary format first: "Energy\n619.9 (526.9 net) / 1972 kcal"
  const energySummary = text.match(/Energy\n([\d,]+(?:\.\d+)?)\s*(?:\([\d,.]+ net\))?\s*\/\s*[\d,.]+ kcal/i);
  if (energySummary) {
    result.food_calories = Math.round(parseFloat(energySummary[1].replace(",", "")));
  }

  // "Protein\n53.0 / 185.0 g"
  const proteinSummary = text.match(/Protein\n([\d,]+(?:\.\d+)?)\s*\/\s*[\d,.]+ g/i);
  if (proteinSummary) {
    result.protein_g = Math.round(parseFloat(proteinSummary[1].replace(",", "")) * 10) / 10;
  }

  // "Net Carbs\n19.4 / 173.0 g"
  const carbsSummary = text.match(/Net Carbs?\n([\d,]+(?:\.\d+)?)\s*\/\s*[\d,.]+ g/i);
  if (carbsSummary) {
    result.carbs_g = Math.round(parseFloat(carbsSummary[1].replace(",", "")) * 10) / 10;
  }

  // "Fat\n35.5 / 60.0 g"
  const fatSummary = text.match(/Fat\n([\d,]+(?:\.\d+)?)\s*\/\s*[\d,.]+ g/i);
  if (fatSummary) {
    result.fat_g = Math.round(parseFloat(fatSummary[1].replace(",", "")) * 10) / 10;
  }

  // Fallback: try generic patterns
  if (result.food_calories == null) {
    const m = text.match(/Energy\s*[:\-]?\s*([\d,]+(?:\.\d+)?)\s*kcal/i)
      || text.match(/Consumed\s*[\n\r]+([\d,]+(?:\.\d+)?)\s*kcal/i);
    if (m) result.food_calories = Math.round(parseFloat(m[1].replace(",", "")));
  }
  if (result.protein_g == null) {
    const m = text.match(/Protein\s*[:\-]?\s*([\d,]+(?:\.\d+)?)\s*g/i);
    if (m) result.protein_g = Math.round(parseFloat(m[1].replace(",", "")) * 10) / 10;
  }
  if (result.carbs_g == null) {
    const m = text.match(/(?:Net\s+)?Carbs?\s*[:\-]?\s*([\d,]+(?:\.\d+)?)\s*g/i);
    if (m) result.carbs_g = Math.round(parseFloat(m[1].replace(",", "")) * 10) / 10;
  }
  if (result.fat_g == null) {
    const m = text.match(/(?:Total\s+)?Fat\s*[:\-]?\s*([\d,]+(?:\.\d+)?)\s*g/i);
    if (m) result.fat_g = Math.round(parseFloat(m[1].replace(",", "")) * 10) / 10;
  }

  // Water: Cronometer shows "Water\n64.0 / 128.0 fl oz" or "Water\n1893 / 3785 mL"
  const waterOz = text.match(/Water\n([\d,]+(?:\.\d+)?)\s*\/\s*[\d,.]+ fl\s*oz/i);
  if (waterOz) {
    result.water_oz = Math.round(parseFloat(waterOz[1].replace(",", "")) * 10) / 10;
  } else {
    // Try mL and convert to oz (1 oz = 29.5735 mL)
    const waterMl = text.match(/Water\n([\d,]+(?:\.\d+)?)\s*\/\s*[\d,.]+ mL/i);
    if (waterMl) {
      result.water_oz = Math.round(parseFloat(waterMl[1].replace(",", "")) / 29.5735 * 10) / 10;
    } else {
      // Fallback: "Water" followed by a number and "oz" or "fl oz"
      const waterFallback = text.match(/Water\s*[:\-]?\s*([\d,]+(?:\.\d+)?)\s*(?:fl\s*)?oz/i);
      if (waterFallback) {
        result.water_oz = Math.round(parseFloat(waterFallback[1].replace(",", "")) * 10) / 10;
      }
    }
  }

  return result;
}
