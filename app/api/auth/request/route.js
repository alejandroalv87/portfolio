import { NextResponse } from "next/server";
import {
  isAllowed,
  normalizeEmail,
  generateCode,
  createChallengeToken,
  challengeCookieOptions,
  CHALLENGE_COOKIE,
} from "@/lib/auth";
import { sendLoginCode } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  let email;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  email = normalizeEmail(email);
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Generic response to avoid revealing which addresses are permitted.
  const generic = NextResponse.json({ ok: true });

  if (!isAllowed(email)) {
    return generic;
  }

  try {
    const code = generateCode();
    const token = await createChallengeToken(email, code);
    await sendLoginCode(email, code);
    generic.cookies.set(CHALLENGE_COOKIE, token, challengeCookieOptions());
    return generic;
  } catch (err) {
    console.error("auth/request failed:", err);
    return NextResponse.json(
      { error: "Could not send the code. Check email settings." },
      { status: 500 }
    );
  }
}
