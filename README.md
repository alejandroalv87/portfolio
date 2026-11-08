# Portfolio Terminal

A private, TIKR-style portfolio terminal. Log in with your email and a one-time
code (real 2FA), import your holdings from a Google Sheets export, and click any
holding to drill into live financials, the next earnings date, institutional
ownership, and insider transactions.

Built with Next.js (App Router). The market-data API key and the email sending
live **server-side only** — they are never exposed to the browser.

---

## What you get

- **Email + one-time-code login (2FA).** Only addresses on your allowlist can
  request a code. The code is emailed over SMTP, held in an *encrypted* cookie
  (no database needed), and exchanged for a signed session cookie. All pages and
  data endpoints are gated by middleware.
- **Holdings import.** Paste or upload a CSV/TSV exported from your Google Sheet.
  Columns (`Symbol`, `Shares`, `Cost basis`) are auto-detected. Holdings are
  stored in your browser (localStorage) — they never leave your device.
- **Live portfolio dashboard.** Market value, day change, total gain/loss, and
  per-position weight, refreshed from live quotes.
- **Stock detail (click any holding or search a ticker):**
  - Overview — company profile + recent earnings beats/misses
  - Financials — quarterly/annual income statement (TIKR-style)
  - Ownership — top institutional holders (13F)
  - Insider Transactions — SEC Form 4 buys/sells
  - Header stats — price, next earnings date + countdown, market cap, P/E, 52-wk range

---

## 1. Prerequisites

- **Node.js 18.18+** (20 or 22 recommended).
- **A market-data API key** from Financial Modeling Prep (FMP):
  https://site.financialmodelingprep.com/developer/docs
  The free tier works for basic quotes/profiles; financial statements, 13F
  ownership and insider endpoints generally need a paid plan. The app degrades
  gracefully and shows "not available" where a plan doesn't cover an endpoint.
- **An SMTP account** to send the login codes. Anything works: a Gmail
  *app password*, Fastmail, Mailgun, Amazon SES, Postmark, Resend (SMTP), etc.

## 2. Configure

```bash
cp .env.example .env.local
```

Edit `.env.local`:

| Variable | What it is |
|---|---|
| `ALLOWED_EMAILS` | Comma-separated list of addresses allowed to log in. |
| `AUTH_SECRET` | Long random string. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `SESSION_DAYS` | How long a login lasts (default 30). |
| `SMTP_HOST/PORT/SECURE/USER/PASS` | Your SMTP server. `SECURE=true` for port 465. |
| `MAIL_FROM` | The From address, e.g. `Portfolio <no-reply@yourdomain.com>`. |
| `FMP_API_KEY` | Your Financial Modeling Prep key. |
| `DATA_CACHE_TTL` | Seconds to cache each data response (default 60). |

> **Gmail tip:** enable 2-Step Verification, then create an *App Password* and use
> it as `SMTP_PASS` with `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`.

## 3. Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

You'll land on `/login`. Enter an allowlisted email, check your inbox for the
6-digit code, and you're in. Then click **Import holdings** and paste your sheet.

## 4. Deploy

### Option A — Vercel (easiest)
1. Push this folder to a Git repo.
2. Import it in Vercel.
3. Add every variable from `.env.local` under **Project → Settings → Environment Variables**.
4. Deploy. (Build command `next build` and output are auto-detected.)

### Option B — Any Node host (Render, Railway, Fly, a VPS)
```bash
npm install
npm run build
npm run start      # serves on $PORT (default 3000)
```
Set the same environment variables in your host's dashboard.

### Option C — Docker
A minimal Dockerfile:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm","run","start"]
```
Pass the env vars with `--env-file .env.local` or your orchestrator's secrets.

---

## Importing from Google Sheets

In your sheet: **File → Download → Comma-separated values (.csv)**. Then in the
app, open **Import holdings** and either paste the contents or upload the file.
A `Symbol`/`Ticker` column is required; `Shares` and `Cost basis` (per-share
average) are optional but needed for gain/loss math. A ready example is in
`holdings.sample.csv`.

If you'd rather have the app read the sheet directly on a schedule, that's a
small addition (a Google Sheets API service account + a server route) — see
"Extending" below.

---

## Security notes (please read)

- **This is already private** because access needs a login code sent to an
  allowlisted inbox. Keep `AUTH_SECRET` secret and rotate it to invalidate all
  sessions.
- The one-time code lives in an **encrypted** cookie, so it can't be read or
  brute-forced from the browser. For a single-user tool this is plenty.
- **Hardening for multiple users / public exposure:** the current design is
  stateless (no DB), so it does not server-side-track failed-attempt counts or
  rate limits. If you expose this widely, add a small store (e.g. Upstash Redis)
  to rate-limit `/api/auth/request` and cap verify attempts. Noted inline in
  `lib/auth.js`.
- Always serve over HTTPS in production (Vercel/Render do this automatically);
  cookies are flagged `Secure` when `NODE_ENV=production`.

---

## Project layout

```
app/
  login/page.js              Email → code login screen
  page.js                    Portfolio dashboard + holdings import
  stock/[symbol]/page.js     Stock detail (overview/financials/ownership/insiders)
  api/auth/*                 request / verify / logout / me
  api/data/*                 quote / profile / financials / earnings / ownership / insiders
lib/
  session.js                 Edge-safe signed session (middleware uses this)
  auth.js                    Allowlist + encrypted one-time-code challenge
  mailer.js                  SMTP sender for the login code
  fmp.js                     Financial Modeling Prep client + cache
  holdings.js                CSV parsing + browser persistence
  format.js                  Number/date formatting
components/AppShell.js       Sidebar, search, logout chrome
middleware.js                Gates every page and data route
```

## Extending

- **Swap the data provider:** everything funnels through `lib/fmp.js`. Replace
  those functions with Polygon, Finnhub, Alpha Vantage, etc., keeping the same
  return shapes and the API routes stay unchanged.
- **Read the Google Sheet directly:** add a service account, share the sheet
  with it, and add an `app/api/holdings/route.js` that returns rows from the
  Sheets API; point the dashboard at it instead of localStorage.
- **Add charts, dividends, or a watchlist:** the dashboard and stock pages are
  plain React — add panels alongside the existing ones.
```
