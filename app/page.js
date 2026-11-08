"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { parseHoldings, loadHoldings, saveHoldings } from "@/lib/holdings";
import { fmtCurrency, fmtNum, fmtPct, signClass } from "@/lib/format";

export default function Dashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [holdings, setHoldings] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [raw, setRaw] = useState("");
  const [parseMsg, setParseMsg] = useState("");

  // who am I
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setEmail(j.email))
      .catch(() => {});
  }, []);

  // initial holdings + import flag
  useEffect(() => {
    const h = loadHoldings();
    setHoldings(h);
    const params = new URLSearchParams(window.location.search);
    if (params.get("import") === "1" || h.length === 0) setShowImport(h.length === 0 ? true : true);
  }, []);

  // fetch quotes when holdings change
  useEffect(() => {
    const syms = holdings.map((h) => h.symbol).filter(Boolean);
    if (!syms.length) { setQuotes({}); return; }
    let cancelled = false;
    setLoadingQuotes(true);
    fetch(`/api/data/quote?symbols=${encodeURIComponent(syms.join(","))}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const map = {};
        (j.data || []).forEach((q) => { map[q.symbol] = q; });
        setQuotes(map);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoadingQuotes(false));
    return () => { cancelled = true; };
  }, [holdings]);

  const rows = useMemo(() => {
    return holdings.map((h) => {
      const q = quotes[h.symbol] || {};
      const price = q.price ?? null;
      const shares = h.shares ?? null;
      const mktValue = price != null && shares != null ? price * shares : null;
      const costBasis = h.cost != null && shares != null ? h.cost * shares : null;
      const gain = mktValue != null && costBasis != null ? mktValue - costBasis : null;
      const gainPct = gain != null && costBasis ? (gain / costBasis) * 100 : null;
      const dayChg = q.change ?? null;
      const dayPct = q.changesPercentage ?? null;
      return {
        ...h, name: h.name || q.name || "", price, shares, mktValue, costBasis,
        gain, gainPct, dayChg, dayPct,
      };
    });
  }, [holdings, quotes]);

  const totals = useMemo(() => {
    let value = 0, cost = 0, day = 0, haveValue = false, haveCost = false;
    rows.forEach((r) => {
      if (r.mktValue != null) { value += r.mktValue; haveValue = true; }
      if (r.costBasis != null) { cost += r.costBasis; haveCost = true; }
      if (r.mktValue != null && r.dayPct != null) {
        const prev = r.mktValue / (1 + r.dayPct / 100);
        day += r.mktValue - prev;
      }
    });
    const gain = haveValue && haveCost ? value - cost : null;
    const gainPct = gain != null && cost ? (gain / cost) * 100 : null;
    const dayPct = value && day ? (day / (value - day)) * 100 : null;
    return { value: haveValue ? value : null, day, dayPct, gain, gainPct, count: rows.length };
  }, [rows]);

  function doImport() {
    const { rows: parsed, error } = parseHoldings(raw);
    if (error) { setParseMsg(error); return; }
    saveHoldings(parsed);
    setHoldings(parsed);
    setParseMsg(`Imported ${parsed.length} holdings.`);
    setShowImport(false);
    setRaw("");
  }

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result || ""));
    reader.readAsText(f);
  }

  const pct = (r) => (totals.value && r.mktValue != null ? (r.mktValue / totals.value) * 100 : null);

  return (
    <AppShell email={email} active="dashboard">
      <div className="wrap-head">
        <div>
          <h1 className="page">Portfolio</h1>
          <div className="sub2">
            {totals.count ? `${totals.count} positions` : "No holdings yet"}
            {loadingQuotes ? " · refreshing prices…" : ""}
          </div>
        </div>
        <div className="flex gap8">
          <button className="btn ghost" onClick={() => setShowImport((v) => !v)}>
            {holdings.length ? "Import / update" : "Import holdings"}
          </button>
        </div>
      </div>

      {(showImport || holdings.length === 0) && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="phead"><h2>Import holdings</h2><span className="sub">CSV / TSV — paste or upload</span></div>
          <div className="pbody">
            <p className="muted" style={{ marginTop: 0 }}>
              Export your Google Sheet (File → Download → CSV) and paste it below or upload the file.
              Columns are detected automatically; a <b>Symbol</b> column is required, with
              optional <b>Shares</b> and <b>Cost&nbsp;basis</b> (per-share average).
            </p>
            <textarea
              className="input" value={raw} onChange={(e) => setRaw(e.target.value)}
              placeholder={"Symbol,Shares,Cost\nAAPL,50,172.40\nGOOGL,30,138.10\nMSFT,20,410.00"}
            />
            <div className="flex gap12 items-center" style={{ marginTop: 12 }}>
              <button className="btn" onClick={doImport} disabled={!raw.trim()}>Import</button>
              <label className="btn ghost" style={{ cursor: "pointer" }}>
                Upload CSV<input type="file" accept=".csv,.tsv,.txt" onChange={onFile} style={{ display: "none" }} />
              </label>
              {parseMsg && <span className="muted">{parseMsg}</span>}
            </div>
          </div>
        </div>
      )}

      {holdings.length > 0 && (
        <>
          <div className="stat-row" style={{ marginBottom: 18 }}>
            <div className="stat">
              <div className="k">Market value</div>
              <div className="v tnum">{fmtCurrency(totals.value)}</div>
            </div>
            <div className="stat">
              <div className="k">Day change</div>
              <div className={"v tnum " + signClass(totals.day)}>{fmtCurrency(totals.day)}</div>
              <div className={"d " + signClass(totals.dayPct)}>{fmtPct(totals.dayPct)}</div>
            </div>
            <div className="stat">
              <div className="k">Total gain / loss</div>
              <div className={"v tnum " + signClass(totals.gain)}>{totals.gain == null ? "–" : fmtCurrency(totals.gain)}</div>
              <div className={"d " + signClass(totals.gainPct)}>{fmtPct(totals.gainPct)}</div>
            </div>
            <div className="stat">
              <div className="k">Positions</div>
              <div className="v tnum">{totals.count}</div>
            </div>
          </div>

          <div className="panel">
            <div className="phead"><h2>Holdings</h2><span className="sub">Click a row for full detail</span></div>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th><th>Price</th><th>Day</th><th>Shares</th>
                    <th>Mkt value</th><th>Avg cost</th><th>Gain / loss</th><th>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.symbol} className="clickable" onClick={() => router.push(`/stock/${r.symbol}`)}>
                      <td><span className="sym">{r.symbol}</span>{r.name && <span className="name">{r.name}</span>}</td>
                      <td>{fmtCurrency(r.price)}</td>
                      <td className={signClass(r.dayPct)}>{fmtPct(r.dayPct)}</td>
                      <td>{fmtNum(r.shares, 4)}</td>
                      <td>{fmtCurrency(r.mktValue)}</td>
                      <td>{r.cost == null ? "–" : fmtCurrency(r.cost)}</td>
                      <td className={signClass(r.gain)}>
                        {r.gain == null ? "–" : fmtCurrency(r.gain)}
                        {r.gainPct != null && <span className="muted"> ({fmtPct(r.gainPct)})</span>}
                      </td>
                      <td>{pct(r) == null ? "–" : fmtPct(pct(r), 1).replace("+", "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
