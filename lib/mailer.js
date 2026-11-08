// Sends the login code by email over SMTP (works with any provider).
import nodemailer from "nodemailer";

let cached = null;

function transporter() {
  if (cached) return cached;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  if (!host) throw new Error("SMTP_HOST is not set");
  cached = nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || (port === 465)).toLowerCase() === "true",
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return cached;
}

export async function sendLoginCode(email, code) {
  const from = process.env.MAIL_FROM || "Portfolio Terminal <no-reply@localhost>";
  const subject = `Your login code: ${code}`;
  const text = `Your Portfolio Terminal login code is ${code}.\n\nIt expires in 10 minutes. If you didn't request this, ignore this email.`;
  const html = `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:440px;margin:0 auto;padding:24px;color:#13161b">
    <div style="font-weight:700;font-size:16px;margin-bottom:6px">Portfolio Terminal</div>
    <p style="color:#555;font-size:14px;margin:0 0 18px">Use this code to finish signing in:</p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;background:#f5f5f3;border-radius:12px;padding:18px;text-align:center;font-family:ui-monospace,Menlo,Consolas,monospace">${code}</div>
    <p style="color:#888;font-size:12.5px;margin:18px 0 0">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
  </div>`;
  await transporter().sendMail({ from, to: email, subject, text, html });
}
