// Holdings parsing + persistence (client-side).
// Accepts CSV/TSV pasted or uploaded. Header detection is flexible so you can
// paste a Google Sheets export without renaming columns.

const SYMBOL_KEYS = ["symbol", "ticker", "tickers", "stock", "security", "code"];
const SHARES_KEYS = ["shares", "qty", "quantity", "units", "# shares", "shares held", "position"];
const COST_KEYS = [
  "cost", "cost basis", "avg cost", "average cost", "avg price", "buy price",
  "price", "cost/share", "cost per share", "unit cost",
];
const NAME_KEYS = ["name", "company", "company name", "description"];

function splitLine(line, delim) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (c === delim && !q) {
      out.push(cur); cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function detectDelim(line) {
  if (line.includes("\t")) return "\t";
  if (line.includes(";") && !line.includes(",")) return ";";
  return ",";
}

function findIndex(headers, keys) {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const k of keys) {
    const i = lower.indexOf(k);
    if (i !== -1) return i;
  }
  // loose contains match
  for (let i = 0; i < lower.length; i++) {
    if (keys.some((k) => lower[i].includes(k))) return i;
  }
  return -1;
}

function toNumber(v) {
  if (v === undefined || v === null) return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isNaN(n) ? null : n;
}

export function parseHoldings(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { rows: [], error: "No data found." };

  const delim = detectDelim(lines[0]);
  const headers = splitLine(lines[0], delim);

  let iSym = findIndex(headers, SYMBOL_KEYS);
  let iSh = findIndex(headers, SHARES_KEYS);
  let iCost = findIndex(headers, COST_KEYS);
  let iName = findIndex(headers, NAME_KEYS);

  let startRow = 1;
  // No header row? Assume: symbol, shares, cost.
  if (iSym === -1) {
    iSym = 0; iSh = 1; iCost = 2; iName = -1; startRow = 0;
  }

  const rows = [];
  for (let r = startRow; r < lines.length; r++) {
    const cols = splitLine(lines[r], delim);
    const symbol = (cols[iSym] || "").toUpperCase().replace(/\s+/g, "");
    if (!symbol || !/^[A-Z0-9.\-]{1,12}$/.test(symbol)) continue;
    rows.push({
      symbol,
      shares: iSh >= 0 ? toNumber(cols[iSh]) : null,
      cost: iCost >= 0 ? toNumber(cols[iCost]) : null,
      name: iName >= 0 ? cols[iName] || "" : "",
    });
  }
  if (!rows.length) return { rows: [], error: "Couldn't find any ticker symbols." };
  return { rows, error: null };
}

const KEY = "pt_holdings_v1";

export function loadHoldings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHoldings(rows) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows || []));
  } catch {
    /* ignore (private mode / blocked storage) */
  }
}
