"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function UpdatePasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    setSuccess("Your password has been updated. You can now continue to MINGLE POS.");
    setLoading(false);
    setTimeout(() => router.replace("/"), 1200);
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#f4f6fb", fontFamily: "Arial, sans-serif" }}>
      <section style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, padding: 30, boxShadow: "0 12px 40px rgba(20,30,60,.09)" }}>
        <p style={{ color: "#64708a", fontSize: 12, fontWeight: 700, letterSpacing: 1.5 }}>MINGLE POS</p>
        <h1 style={{ color: "#17213b", fontSize: 26 }}>Choose a new password</h1>
        <form onSubmit={handleSubmit}>
          <label htmlFor="password" style={{ display: "block", marginBottom: 7, fontWeight: 600 }}>New password</label>
          <input id="password" type="password" autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} style={{ boxSizing: "border-box", width: "100%", padding: 13, border: "1px solid #d7ddea", borderRadius: 9, marginBottom: 16 }} />
          <label htmlFor="confirm" style={{ display: "block", marginBottom: 7, fontWeight: 600 }}>Confirm new password</label>
          <input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} style={{ boxSizing: "border-box", width: "100%", padding: 13, border: "1px solid #d7ddea", borderRadius: 9, marginBottom: 18 }} />
          {error && <p role="alert" style={{ color: "#b42318", background: "#fff1f0", padding: 11, borderRadius: 8 }}>{error}</p>}
          {success && <p role="status" style={{ color: "#176b3a", background: "#edfaf1", padding: 11, borderRadius: 8 }}>{success}</p>}
          <button type="submit" disabled={loading} style={{ width: "100%", border: 0, borderRadius: 9, padding: 14, color: "#fff", background: "#243b75", fontWeight: 700 }}>{loading ? "Updating..." : "Update password"}</button>
        </form>
      </section>
    </main>
  );
}
