"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function BusinessApplicationPage() {
  const [form, setForm] = useState({ businessName: "", ownerName: "", email: "", phone: "", businessType: "Mini supermarket", location: "", website: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function update(field: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/business-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit your application.");
      setSuccess(result.message || "Application submitted successfully.");
      setForm({ businessName: "", ownerName: "", email: "", phone: "", businessType: "Mini supermarket", location: "", website: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit your application.");
    } finally { setLoading(false); }
  }

  const inputStyle = { boxSizing: "border-box" as const, width: "100%", marginTop: 7, padding: 12, border: "1px solid #dce2eb", borderRadius: 9, fontSize: 14, background: "white" };
  const labelStyle = { display: "block", fontSize: 13, fontWeight: 600 as const, color: "#344054" };

  return <main style={{ minHeight: "100vh", background: "#f5f7fb", padding: "32px 16px", color: "#182230", fontFamily: "Inter, Arial, sans-serif" }}>
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <p style={{ color: "#635bdb", fontWeight: 800, letterSpacing: 1.5, fontSize: 12 }}>SIR NICK TECHNOLOGIES</p>
        <h1 style={{ fontSize: 30, margin: "8px 0" }}>Apply for MINGLE POS</h1>
        <p style={{ color: "#667085", fontSize: 14, lineHeight: 1.6 }}>Tell us about your business. Every application is reviewed before an account is approved.</p>
      </div>
      <form onSubmit={submit} style={{ background: "white", border: "1px solid #e7ebf2", borderRadius: 16, padding: 22, display: "grid", gap: 16 }}>
        {error && <div role="alert" style={{ background: "#fff0f0", color: "#a52d2d", padding: 12, borderRadius: 8, fontSize: 13 }}>{error}</div>}
        {success && <div role="status" style={{ background: "#edfaf1", color: "#176b3a", padding: 12, borderRadius: 8, fontSize: 13 }}>{success}</div>}
        <label style={labelStyle}>Business name<input required maxLength={100} value={form.businessName} onChange={e => update("businessName", e.target.value)} placeholder="e.g. Town Mini Mart" style={inputStyle} /></label>
        <label style={labelStyle}>Owner's full name<input required maxLength={100} value={form.ownerName} onChange={e => update("ownerName", e.target.value)} placeholder="Your full name" style={inputStyle} /></label>
        <label style={labelStyle}>Email address<input required type="email" maxLength={254} value={form.email} onChange={e => update("email", e.target.value)} placeholder="you@example.com" style={inputStyle} /></label>
        <label style={labelStyle}>Phone number<input required type="tel" maxLength={30} value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="+254..." style={inputStyle} /></label>
        <label style={labelStyle}>Business type<select value={form.businessType} onChange={e => update("businessType", e.target.value)} style={inputStyle}>{["Mini supermarket", "Supermarket", "Retail shop", "Wholesale shop", "Electronics shop", "Pharmacy", "Restaurant / Hotel", "Other"].map(type => <option key={type}>{type}</option>)}</select></label>
        <label style={labelStyle}>Business location<input required maxLength={150} value={form.location} onChange={e => update("location", e.target.value)} placeholder="Town / area / county" style={inputStyle} /></label>
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={e => update("website", e.target.value)} /></label></div>
        <button type="submit" disabled={loading} style={{ border: 0, borderRadius: 9, padding: 14, background: "#635bdb", color: "white", fontWeight: 700, fontSize: 14, opacity: loading ? .65 : 1 }}>{loading ? "Submitting..." : "Submit application"}</button>
        <p style={{ textAlign: "center", color: "#98a2b3", fontSize: 11, margin: 0 }}>Submitting an application does not automatically create an account. MINGLE POS will contact you after review.</p>
      </form>
      <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#667085" }}>Already have an account? <Link href="/login" style={{ color: "#635bdb" }}>Sign in</Link></p>
    </div>
  </main>;
}