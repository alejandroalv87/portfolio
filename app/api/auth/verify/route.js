import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  readChallengeToken,
  codesMatch,
  isAllowed,
  CHALLENGE_COOKIE,
} from "@/lib/auth";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  let code;
  try {
    ({ code } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  code = String(code || "").trim();

  const token = cookies().get(CHALLENGE_COOKIE)?.value;
  const challenge = await readChallengeToken(token);
  if (!challenge) {
    return NextResponse.json(
      { error: "Your code expired. Request a new one." },
      { status: 400 }
    );
  }

  if (!isAllowed(challenge.email) || !codesMatch(code, challenge.code)) {
    return NextResponse.json({ error: "Incorrect code. Try again." }, { status: 400 });
  }

  const session = await createSessionToken(challenge.email);
  const res = NextResponse.json({ ok: true, email: challenge.email });
  res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
  res.cookies.set(CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
