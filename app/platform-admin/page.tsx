"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
type ClientAccount = { owner_id: string; email: string; business_name: string; created_at: string };
export default function PlatformAdminPage() {
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadClients = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/platform-admin/clients", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "You are not authorized to access Platform Admin.");
      setClients(result.clients || []);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load client accounts."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadClients(); }, [loadClients]);
  async function createClientAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/platform-admin/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName, email }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create the client account.");
      setNotice(result.message); setBusinessName(""); setEmail(""); await loadClients();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create the client account."); }
    finally { setSaving(false); }
  }
  return <main style={{ minHeight: "100vh", background: "#f5f7fb", color: "#182230", padding: "24px 16px", fontFamily: "Inter, Arial, sans-serif" }}>
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#635bdb", textDecoration: "none", fontSize: 13, marginBottom: 24 }}><ArrowLeft size={17} /> Back to dashboard</Link>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 46, height: 46, display: "grid", placeItems: "center", borderRadius: 12, color: "#635bdb", background: "#ecebff" }}><ShieldCheck size={24} /></div>
        <div><p style={{ color: "#635bdb", fontSize: 11, fontWeight: 700, letterSpacing: 1.3, margin: 0 }}>SIR NICK TECHNOLOGIES · MINGLE POS</p><h1 style={{ fontSize: 27, margin: "5px 0" }}>Platform Admin</h1><p style={{ color: "#778294", fontSize: 13, margin: 0 }}>Only approved administrators can create business owner accounts.</p></div>
      </header>
      {error && <div role="alert" style={{ background: "#fff0f0", color: "#a52d2d", borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 16 }}>{error}</div>}
      {notice && <div role="status" style={{ background: "#edfaf1", color: "#176b3a", borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 16 }}>{notice}</div>}
      <section style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 13, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}><UserPlus size={19} /> Approve and onboard a business</h2>
        <p style={{ color: "#778294", fontSize: 13, margin: "0 0 18px" }}>After reviewing a business request, enter the business name and owner's email. MINGLE POS sends the owner a secure account invitation.</p>
        <form onSubmit={createClientAccount} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Business name<input required maxLength={100} value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. My Mini Supermarket" style={{ boxSizing: "border-box", display: "block", width: "100%", marginTop: 7, padding: 12, border: "1px solid #dfe4ec", borderRadius: 8 }} /></label>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Owner email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="owner@example.com" style={{ boxSizing: "border-box", display: "block", width: "100%", marginTop: 7, padding: 12, border: "1px solid #dfe4ec", borderRadius: 8 }} /></label>
          <button disabled={saving} type="submit" style={{ alignSelf: "end", border: 0, borderRadius: 8, background: "#635bdb", color: "white", padding: 13, fontWeight: 700, opacity: saving ? .6 : 1 }}>{saving ? "Sending invitation..." : "Approve & invite owner"}</button>
        </form>
      </section>
      <section style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 13, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 16 }}><h2 style={{ fontSize: 18, margin: 0, display: "flex", alignItems: "center", gap: 8 }}><Building2 size={19} /> Active business accounts</h2><button onClick={() => void loadClients()} aria-label="Refresh business accounts" style={{ border: "1px solid #e5e8ef", background: "white", borderRadius: 8, padding: 9 }}><RefreshCw size={16} /></button></div>
        {loading ? <p style={{ color: "#778294" }}>Loading business accounts...</p> : clients.length === 0 ? <p style={{ color: "#778294", fontSize: 13 }}>No business owner accounts found yet.</p> :
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540, textAlign: "left" }}>
            <thead><tr style={{ background: "#f8f9fc", color: "#8490a2", fontSize: 11, textTransform: "uppercase" }}><th style={{ padding: 12 }}>Business</th><th style={{ padding: 12 }}>Owner email</th><th style={{ padding: 12 }}>Account created</th><th style={{ padding: 12 }}>Owner ID</th></tr></thead>
            <tbody>{clients.map(client => <tr key={client.owner_id} style={{ borderBottom: "1px solid #e9edf3", fontSize: 13 }}><td style={{ padding: 12, fontWeight: 600 }}>{client.business_name}</td><td style={{ padding: 12 }}>{client.email}</td><td style={{ padding: 12 }}>{new Date(client.created_at).toLocaleDateString("en-KE")}</td><td style={{ padding: 12, fontSize: 11, color: "#778294" }}>{client.owner_id.slice(0, 8)}…</td></tr>)}</tbody>
          </table></div>}
      </section>
    </div>
  </main>;
}
