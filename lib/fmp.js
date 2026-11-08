// Server-side client for Financial Modeling Prep (FMP).
// The API key is read from the environment and never leaves the server.
// A tiny in-memory cache keeps us under rate limits while staying "live".
const BASE = "https://financialmodelingprep.com";
const cache = new Map(); // key -> { at:number, data:any }

function ttlMs() {
  return Math.max(0, Number(process.env.DATA_CACHE_TTL || 60)) * 1000;
}

function apiKey() {
  const k = process.env.FMP_API_KEY;
  if (!k) throw new Error("FMP_API_KEY is not set");
  return k;
}

async function getJSON(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  url.searchParams.set("apikey", apiKey());

  const key = url.pathname + "?" + url.searchParams.toString().replace(/apikey=[^&]+/, "");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs()) return hit.data;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`FMP ${res.status} on ${path}: ${body.slice(0, 160)}`);
  }
  const data = await res.json();
  if (data && data["Error Message"]) throw new Error(data["Error Message"]);
  cache.set(key, { at: Date.now(), data });
  return data;
}

const first = (arr) => (Array.isArray(arr) && arr.length ? arr[0] : null);

export async function getQuote(symbol) {
  return first(await getJSON(`/api/v3/quote/${encodeURIComponent(symbol)}`));
}

export async function getQuotes(symbols) {
  const list = (Array.isArray(symbols) ? symbols : String(symbols).split(","))
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (!list.length) return [];
  const data = await getJSON(`/api/v3/quote/${encodeURIComponent(list.join(","))}`);
  return Array.isArray(data) ? data : [];
}

export async function getProfile(symbol) {
  return first(await getJSON(`/api/v3/profile/${encodeURIComponent(symbol)}`));
}

export async function getIncomeStatement(symbol, period = "quarter", limit = 8) {
  const data = await getJSON(`/api/v3/income-statement/${encodeURIComponent(symbol)}`, {
    period,
    limit,
  });
  return Array.isArray(data) ? data : [];
}

export async function getEarnings(symbol) {
  // Historical + upcoming earnings for the symbol.
  const data = await getJSON(
    `/api/v3/historical/earning_calendar/${encodeURIComponent(symbol)}`
  );
  const rows = Array.isArray(data) ? data : [];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = rows
    .filter((r) => r.date && r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = rows
    .filter((r) => r.date && r.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));
  return { next: upcoming[0] || null, upcoming: upcoming.slice(0, 4), past: past.slice(0, 6) };
}

export async function getInstitutionalHolders(symbol, limit = 25) {
  const data = await getJSON(`/api/v3/institutional-holder/${encodeURIComponent(symbol)}`);
  const rows = Array.isArray(data) ? data : [];
  return rows
    .sort((a, b) => (b.shares || 0) - (a.shares || 0))
    .slice(0, limit);
}

export async function getInsiderTrades(symbol, limit = 40) {
  // v4 insider trading endpoint.
  const data = await getJSON(`/api/v4/insider-trading`, { symbol, page: 0 });
  const rows = Array.isArray(data) ? data : [];
  return rows.slice(0, limit);
}
