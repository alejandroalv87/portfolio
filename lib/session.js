// Edge-safe session helpers (used by middleware and API routes).
// Uses an HMAC-signed JWT; the secret can be any length of bytes.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "pt_session";

function secretKey() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export function sessionMaxAgeSeconds() {
  const days = Number(process.env.SESSION_DAYS || 30);
  return Math.max(1, days) * 24 * 60 * 60;
}

export async function createSessionToken(email) {
  const maxAge = sessionMaxAgeSeconds();
  return await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .sign(secretKey());
}

export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    return payload; // { email, sub, iat, exp }
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAgeSeconds(),
  };
}
