"use client";

import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";

export default function EmployeeJoinPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/employee-registration", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fullName, email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Registration could not be completed.");
      setNotice(result.message);
      setFullName(""); setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration could not be completed.");
    } finally { setBusy(false); }
  }

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f7fb", padding: 18, fontFamily: "Inter, Arial, sans-serif", color: "#182230" }}>
    <section style={{ width: "100%", maxWidth: 440, background: "white", border: "1px solid #e9edf3", borderRadius: 16, padding: 24, boxSizing: "border-box" }}>
      <div style={{ color: "#635bdb", fontWeight: 800, letterSpacing: 1.2, fontSize: 12 }}>MINGLE POS</div>
      <h1 style={{ fontSize: 25, margin: "10px 0 6px" }}>Join a business team</h1>
      <p style={{ color: "#778294", fontSize: 14, lineHeight: 1.6 }}>Register with your own email address. We will email you a secure link to set your password. Your account will join this business as a cashier.</p>
      {error && <div role="alert" style={{ background: "#fff0f0", color: "#a52d2d", borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 14 }}>{error}</div>}
      {notice ? <div role="status" style={{ background: "#edfaf1", color: "#176b3a", borderRadius: 8, padding: 14, fontSize: 14, lineHeight: 1.6 }}>{notice}</div> :
        <form onSubmit={register} style={{ display: "grid", gap: 13 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Full name<input required maxLength={100} autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" style={{ boxSizing: "border-box", width: "100%", display: "block", marginTop: 6, padding: 12, border: "1px solid #dfe4ec", borderRadius: 8 }} /></label>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Email address<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={{ boxSizing: "border-box", width: "100%", display: "block", marginTop: 6, padding: 12, border: "1px solid #dfe4ec", borderRadius: 8 }} /></label>
          <button disabled={busy} type="submit" style={{ border: 0, borderRadius: 8, background: "#635bdb", color: "white", padding: 13, fontWeight: 700, opacity: busy ? .65 : 1 }}>{busy ? "Registering..." : "Register as employee"}</button>
        </form>}
      <p style={{ color: "#8a94a5", fontSize: 11, marginTop: 18 }}>Only people with this business invitation link can request to join. The owner can disable or replace the link at any time.</p>
    </section>
  </main>;
}
