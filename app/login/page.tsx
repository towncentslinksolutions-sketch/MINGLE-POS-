"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#f4f6fb", fontFamily: "Arial, sans-serif" }}>
      <section style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, padding: 30, boxShadow: "0 12px 40px rgba(20,30,60,.09)" }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, display: "grid", placeItems: "center", background: "#18264b", color: "#fff", fontSize: 25, fontWeight: 800, marginBottom: 20 }}>M</div>
        <p style={{ color: "#64708a", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, margin: "0 0 8px" }}>MINGLE POS</p>
        <h1 style={{ color: "#17213b", fontSize: 26, margin: "0 0 8px" }}>Sign in to your account</h1>
        <p style={{ color: "#69748b", margin: "0 0 24px", lineHeight: 1.5 }}>Use your administrator or employee account to continue.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email" style={{ display: "block", color: "#27334e", fontWeight: 600, fontSize: 14, marginBottom: 7 }}>Email address</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" style={{ boxSizing: "border-box", width: "100%", padding: "13px 14px", border: "1px solid #d7ddea", borderRadius: 9, marginBottom: 18, fontSize: 15 }} />
          <label htmlFor="password" style={{ display: "block", color: "#27334e", fontWeight: 600, fontSize: 14, marginBottom: 7 }}>Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" style={{ boxSizing: "border-box", width: "100%", padding: "13px 14px", border: "1px solid #d7ddea", borderRadius: 9, marginBottom: 18, fontSize: 15 }} />
          {error && <p role="alert" style={{ color: "#b42318", background: "#fff1f0", borderRadius: 8, padding: 11, fontSize: 14, margin: "0 0 16px" }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: "100%", border: 0, borderRadius: 9, padding: 14, color: "#fff", background: loading ? "#8792ad" : "#243b75", fontWeight: 700, fontSize: 15, cursor: loading ? "wait" : "pointer" }}>{loading ? "Signing in..." : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}
