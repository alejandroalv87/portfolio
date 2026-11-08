import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/fmp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const p = req.nextUrl.searchParams;
  const symbols = p.get("symbols") || p.get("symbol");
  if (!symbols) return NextResponse.json({ error: "symbol(s) required" }, { status: 400 });
  try {
    const data = await getQuotes(symbols);
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 502 });
  }
}
