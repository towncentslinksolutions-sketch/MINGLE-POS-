"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Save } from "lucide-react";

type Settings = { mpesa_shortcode: string; daraja_environment: "sandbox" | "production"; enabled: boolean };

export default function PaymentSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [shortcode, setShortcode] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [passkey, setPasskey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/payment-settings").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load payment settings.");
      if (active && data.settings) {
        setSettings(data.settings);
        setShortcode(data.settings.mpesa_shortcode || "");
        setEnvironment(data.settings.daraja_environment || "sandbox");
      }
    }).catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/payment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mpesa_shortcode: shortcode, daraja_environment: environment, consumer_key: consumerKey, consumer_secret: consumerSecret, passkey }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save payment settings.");
      setMessage(data.message || "Credentials saved securely.");
      setConsumerKey(""); setConsumerSecret(""); setPasskey("");
      setSettings({ mpesa_shortcode: shortcode, daraja_environment: environment, enabled: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save payment settings.");
    } finally { setSaving(false); }
  }

  const field: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #dce2eb", borderRadius: 8, marginTop: 7, marginBottom: 16, background: "white" };

  return <main style={{ minHeight: "100vh", background: "#f5f7fb", color: "#182230", padding: "24px 16px", fontFamily: "Inter, Arial, sans-serif" }}>
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#635bdb", textDecoration: "none", fontSize: 13, marginBottom: 24 }}><ArrowLeft size={17} /> Back to dashboard</Link>
      <h1 style={{ fontSize: 27, marginBottom: 7 }}>M-Pesa payment settings</h1>
      <p style={{ color: "#778294", fontSize: 14, lineHeight: 1.6 }}>Connect this business's own Safaricom Daraja Paybill credentials. Only the business owner can access this page.</p>
      <section style={{ background: "white", border: "1px solid #e8edf4", borderRadius: 13, padding: 20, marginTop: 20 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#f2f7ff", padding: 13, borderRadius: 9, marginBottom: 20, color: "#294c7a", fontSize: 13 }}>
          <ShieldCheck size={20} /> Credentials are encrypted on the server before being stored. They are never sent back to the browser.
        </div>
        {loading ? <p>Loading settings...</p> : <form onSubmit={save}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 650 }}>Paybill shortcode<input required value={shortcode} onChange={(e) => setShortcode(e.target.value)} placeholder="Your business Paybill number" style={field} /></label>
          <label style={{ display: "block", fontSize: 13, fontWeight: 650 }}>Daraja environment<select value={environment} onChange={(e) => setEnvironment(e.target.value as "sandbox" | "production")} style={field}><option value="sandbox">Sandbox (testing)</option><option value="production">Production (live)</option></select></label>
          <label style={{ display: "block", fontSize: 13, fontWeight: 650 }}>Consumer Key<input required value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} autoComplete="off" style={field} /></label>
          <label style={{ display: "block", fontSize: 13, fontWeight: 650 }}>Consumer Secret<input required type="password" value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} autoComplete="new-password" style={field} /></label>
          <label style={{ display: "block", fontSize: 13, fontWeight: 650 }}>Lipa na M-Pesa Passkey<input required type="password" value={passkey} onChange={(e) => setPasskey(e.target.value)} autoComplete="new-password" style={field} /></label>
          {settings && <p style={{ color: "#778294", fontSize: 12 }}>A Paybill is already saved for this business. Enter all three credentials again to replace them.</p>}
          {error && <p role="alert" style={{ color: "#a52d2d", background: "#fff0f0", padding: 11, borderRadius: 7, fontSize: 13 }}>{error}</p>}
          {message && <p role="status" style={{ color: "#17633b", background: "#eefaf2", padding: 11, borderRadius: 7, fontSize: 13 }}>{message}</p>}
          <button disabled={saving} type="submit" style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, border: 0, borderRadius: 8, padding: 13, background: "#635bdb", color: "white", fontWeight: 700, opacity: saving ? .6 : 1 }}><Save size={17} />{saving ? "Saving securely..." : "Save M-Pesa credentials"}</button>
        </form>}
        <p style={{ color: "#778294", fontSize: 12, lineHeight: 1.6, marginTop: 18 }}>Saving credentials does not activate live payments. The STK Push, callback verification and transaction reconciliation still need to be implemented and tested with Safaricom Daraja.</p>
      </section>
    </div>
  </main>;
}
