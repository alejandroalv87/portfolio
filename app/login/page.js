"use client";
import { useState } from "react";

export default function LoginPage() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function requestCode(e) {
    e?.preventDefault();
    setError(""); setNote(""); setBusy(true);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Something went wrong.");
      setStep("code");
      setNote(`If ${email} is permitted, a 6-digit code is on its way.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e?.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Verification failed.");
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/";
      window.location.assign(next.startsWith("/") ? next : "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1><span className="mark">◆</span> Portfolio Terminal</h1>

        {step === "email" && (
          <>
            <p className="lead">Sign in with your email. We'll send a one-time code to confirm it's you.</p>
            <form onSubmit={requestCode}>
              <div className="field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email" className="input" type="email" autoComplete="email" autoFocus
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" required
                />
              </div>
              <button className="btn" style={{ width: "100%" }} disabled={busy || !email}>
                {busy ? <span className="spin" /> : "Send me a code"}
              </button>
              {error && <div className="err">{error}</div>}
            </form>
          </>
        )}

        {step === "code" && (
          <>
            <p className="lead">Enter the 6-digit code sent to <b>{email}</b>.</p>
            <form onSubmit={verify}>
              <div className="field">
                <label htmlFor="code">Verification code</label>
                <input
                  id="code" className="input code-input" inputMode="numeric" autoComplete="one-time-code"
                  autoFocus maxLength={6} value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="______"
                />
              </div>
              <button className="btn" style={{ width: "100%" }} disabled={busy || code.length < 6}>
                {busy ? <span className="spin" /> : "Verify & sign in"}
              </button>
              {note && <div className="ok">{note}</div>}
              {error && <div className="err">{error}</div>}
            </form>
            <div className="center-note">
              Didn't get it?{" "}
              <button className="linkbtn" onClick={requestCode} disabled={busy}>Resend code</button>
              {"  ·  "}
              <button className="linkbtn" onClick={() => { setStep("email"); setCode(""); setError(""); setNote(""); }}>
                Use a different email
              </button>
            </div>
          </>
        )}

        <div className="center-note" style={{ marginTop: 22 }}>
          Access is restricted to approved email addresses.
        </div>
      </div>
    </div>
  );
}
