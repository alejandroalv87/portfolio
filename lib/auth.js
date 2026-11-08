// Node-runtime auth helpers: email allowlist + encrypted one-time-code challenge.
// The challenge (which carries the 6-digit code) is stored in an ENCRYPTED JWT
// cookie, so the browser cannot read or brute-force the code. No database needed.
import crypto from "crypto";
import { EncryptJWT, jwtDecrypt } from "jose";

export const CHALLENGE_COOKIE = "pt_challenge";
const CHALLENGE_TTL_SECONDS = 10 * 60; // code valid for 10 minutes

function challengeKey() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  // 32 bytes for A256GCM "dir" encryption.
  return new Uint8Array(crypto.createHash("sha256").update(s).digest());
}

export function allowedEmails() {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email) {
  if (!email) return false;
  return allowedEmails().includes(String(email).trim().toLowerCase());
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function generateCode() {
  // 6-digit numeric code, cryptographically random, zero-padded.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function createChallengeToken(email, code) {
  return await new EncryptJWT({ email: normalizeEmail(email), code })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS)
    .encrypt(challengeKey());
}

export async function readChallengeToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, challengeKey());
    return payload; // { email, code, iat, exp }
  } catch {
    return null;
  }
}

export function codesMatch(a, b) {
  const ba = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function challengeCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
  };
}
