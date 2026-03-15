import { getDb } from "./db";

const OURA_API = "https://api.ouraring.com";
const OURA_AUTH_URL = "https://cloud.ouraring.com/oauth/authorize";
const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";

export function getOuraClientId(): string {
  return process.env.OURA_CLIENT_ID || "";
}

function getOuraClientSecret(): string {
  return process.env.OURA_CLIENT_SECRET || "";
}

export function getOuraAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getOuraClientId(),
    redirect_uri: redirectUri,
    scope: "daily heartrate personal session workout",
  });
  return `${OURA_AUTH_URL}?${params}`;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: getOuraClientId(),
      client_secret: getOuraClientSecret(),
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const data = await res.json();

  const db = getDb();
  db.prepare(`
    INSERT INTO oura_auth (id, access_token, refresh_token, expires_at, updated_at)
    VALUES (1, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      updated_at = datetime('now')
  `).run(data.access_token, data.refresh_token, Math.floor(Date.now() / 1000) + data.expires_in);

  return data;
}

async function refreshToken(): Promise<string> {
  const db = getDb();
  const row = db.prepare("SELECT * FROM oura_auth WHERE id = 1").get() as Record<string, unknown> | undefined;
  if (!row?.refresh_token) throw new Error("No Oura refresh token");

  const res = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token as string,
      client_id: getOuraClientId(),
      client_secret: getOuraClientSecret(),
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const data = await res.json();

  db.prepare(`
    UPDATE oura_auth SET
      access_token = ?,
      refresh_token = ?,
      expires_at = ?,
      updated_at = datetime('now')
    WHERE id = 1
  `).run(data.access_token, data.refresh_token, Math.floor(Date.now() / 1000) + data.expires_in);

  return data.access_token;
}

export async function getAccessToken(): Promise<string> {
  const db = getDb();
  const row = db.prepare("SELECT * FROM oura_auth WHERE id = 1").get() as Record<string, unknown> | undefined;
  if (!row?.access_token) throw new Error("Oura not connected");

  const expiresAt = row.expires_at as number;
  if (Date.now() / 1000 > expiresAt - 300) {
    return refreshToken();
  }
  return row.access_token as string;
}

export async function ouraGet(path: string, params?: Record<string, string>) {
  const token = await getAccessToken();
  const url = new URL(path, OURA_API);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Oura API error: ${res.status}`);
  return res.json();
}
