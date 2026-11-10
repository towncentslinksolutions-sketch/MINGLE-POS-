"use client";

import { useEffect, useState } from "react";
import type { FormEvent, CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Building2, Headset, ReceiptText } from "lucide-react";

type Settings = {
  business_name: string; logo_url: string; business_phone: string; business_email: string;
  business_address: string; support_phone: string; support_email: string; support_whatsapp: string;
  currency: string; tax_rate: number; receipt_footer: string; return_policy: string;
};

const empty: Settings = {
  business_name: "", logo_url: "", business_phone: "", business_email: "", business_address: "",
  support_phone: "", support_email: "", support_whatsapp: "", currency: "KES", tax_rate: 0,
  receipt_footer: "Thank you for shopping with us!", return_policy: ""
};

const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #dce2eb",
  borderRadius: 8, marginTop: 7, background: "white", color: "#182230", font: "inherit"
};

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string | number; onChange: (value: string) => void;
  placeholder?: string; type?: string;
}) {
  return <label style={{ display: "block", fontSize: 13, fontWeight: 650, marginBottom: 16 }}>
    {label}
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder} style={inputStyle} />
  </label>;
}

export default function BusinessSettingsPage() {
  const [form, setForm] = useState<Settings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/business-settings").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load business settings.");
      if (active && data.settings) setForm({ ...empty, ...data.settings });
    }).catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function update(key: keyof Settings, value: string) {
    setForm((previous) => ({ ...previous, [key]: key === "tax_rate" ? Number(value) : value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/business-settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tax_rate: Number(form.tax_rate) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save business settings.");
      setMessage(data.message || "Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save settings.");
    } finally { setSaving(false); }
  }

  const section: CSSProperties = { background: "white", border: "1px solid #e8edf4", borderRadius: 13, padding: 20, marginTop: 16 };
  const heading: CSSProperties = { display: "flex", alignItems: "center", gap: 9, fontSize: 17, margin: "0 0 18px" };

  return <main style={{ minHeight: "100vh", background: "#f5f7fb", color: "#182230", padding: "24px 16px", fontFamily: "Inter, Arial, sans-serif" }}>
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#635bdb", textDecoration: "none", fontSize: 13, marginBottom: 22 }}>
        <ArrowLeft size={17} /> Back to dashboard
      </Link>
      <h1 style={{ fontSize: 27, margin: "0 0 7px" }}>Business settings</h1>
      <p style={{ color: "#778294", fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>Manage your store profile and the contact details shown to your customers. These settings belong only to your business.</p>
      {loading ? <section style={section}>Loading your settings...</section> : <form onSubmit={save}>
        <section style={section}>
          <h2 style={heading}><Building2 size={19} /> Business profile</h2>
          <Field label="Business / store name" value={form.business_name} onChange={(v) => update("business_name", v)} placeholder="e.g. My Supermarket" />
          <Field label="Business logo image URL (optional)" value={form.logo_url} onChange={(v) => update("logo_url", v)} placeholder="https://..." />
          <Field label="Business phone number" value={form.business_phone} onChange={(v) => update("business_phone", v)} placeholder="+254..." />
          <Field label="Business email" value={form.business_email} onChange={(v) => update("business_email", v)} placeholder="info@example.com" type="email" />
          <label style={{ display: "block", fontSize: 13, fontWeight: 650 }}>Business address
            <textarea value={form.business_address} onChange={(e) => update("business_address", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="Street, town, county" />
          </label>
        </section>
        <section style={section}>
          <h2 style={heading}><Headset size={19} /> Customer support contacts</h2>
          <Field label="Support phone number" value={form.support_phone} onChange={(v) => update("support_phone", v)} placeholder="+254..." />
          <Field label="Support email" value={form.support_email} onChange={(v) => update("support_email", v)} placeholder="support@example.com" type="email" />
          <Field label="WhatsApp support number" value={form.support_whatsapp} onChange={(v) => update("support_whatsapp", v)} placeholder="+254..." />
        </section>
        <section style={section}>
          <h2 style={heading}><ReceiptText size={19} /> Sales and receipt preferences</h2>
          <Field label="Currency code" value={form.currency} onChange={(v) => update("currency", v.toUpperCase())} placeholder="KES" />
          <Field label="Tax rate (%)" value={form.tax_rate} onChange={(v) => update("tax_rate", v)} placeholder="0" type="number" />
          <label style={{ display: "block", fontSize: 13, fontWeight: 650, marginBottom: 16 }}>Receipt footer
            <textarea value={form.receipt_footer} onChange={(e) => update("receipt_footer", e.target.value)} rows={2} maxLength={1000} style={{ ...inputStyle, resize: "vertical" }} />
          </label>
          <label style={{ display: "block", fontSize: 13, fontWeight: 650 }}>Return policy
            <textarea value={form.return_policy} onChange={(e) => update("return_policy", e.target.value)} rows={3} maxLength={1000} style={{ ...inputStyle, resize: "vertical" }} placeholder="Enter your store return policy" />
          </label>
        </section>
        {error && <p role="alert" style={{ color: "#a52d2d", background: "#fff0f0", padding: 11, borderRadius: 7, fontSize: 13 }}>{error}</p>}
        {message && <p role="status" style={{ color: "#17633b", background: "#eefaf2", padding: 11, borderRadius: 7, fontSize: 13 }}>{message}</p>}
        <button disabled={saving} type="submit" style={{ width: "100%", marginTop: 16, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, border: 0, borderRadius: 8, padding: 14, background: "#635bdb", color: "white", fontWeight: 700, opacity: saving ? .6 : 1 }}>
          <Save size={17} /> {saving ? "Saving..." : "Save business settings"}
        </button>
      </form>}
      <p style={{ color: "#778294", fontSize: 12, marginTop: 18 }}>Only the business owner can edit these settings. Other businesses have separate records.</p>
    </div>
  </main>;
}
