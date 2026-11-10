"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, RefreshCw, XCircle } from "lucide-react";

type Application = {
  id: string; business_name: string; owner_name: string; email: string; phone: string;
  business_type: string; location: string; status: "pending" | "approved" | "rejected";
  admin_notes: string; created_at: string;
};

export default function PlatformAdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/platform-admin/applications", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load applications.");
      setApplications(result.applications || []);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load applications."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(application: Application, action: "approve" | "reject") {
    const prompt = action === "approve"
      ? `Approve ${application.business_name} and send an account invitation to ${application.email}?`
      : `Reject the application from ${application.business_name}?`;
    if (!window.confirm(prompt)) return;
    setWorking(application.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/platform-admin/applications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: application.id, action, notes: notes[application.id] || "" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to review application.");
      setNotice(result.message || "Application updated.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to review application."); }
    finally { setWorking(""); }
  }

  const pending = applications.filter(item => item.status === "pending");
  return <main style={{ minHeight: "100vh", background: "#f5f7fb", color: "#182230", padding: "24px 16px", fontFamily: "Inter, Arial, sans-serif" }}>
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <Link href="/platform-admin" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#635bdb", textDecoration: "none", fontSize: 13, marginBottom: 22 }}><ArrowLeft size={17} /> Platform Admin</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div><p style={{ color: "#635bdb", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, margin: 0 }}>SIR NICK TECHNOLOGIES · MINGLE POS</p><h1 style={{ fontSize: 27, margin: "5px 0" }}>Business applications</h1><p style={{ color: "#778294", fontSize: 13, margin: 0 }}>{pending.length} awaiting review</p></div>
        <button onClick={() => void load()} aria-label="Refresh applications" style={{ border: "1px solid #e5e8ef", background: "white", borderRadius: 8, padding: 10 }}><RefreshCw size={17} /></button>
      </div>
      {error && <div role="alert" style={{ background: "#fff0f0", color: "#a52d2d", borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 14 }}>{error}</div>}
      {notice && <div role="status" style={{ background: "#edfaf1", color: "#176b3a", borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 14 }}>{notice}</div>}
      {loading ? <p>Loading applications...</p> : applications.length === 0 ? <section style={{ background: "white", padding: 22, borderRadius: 12, color: "#778294" }}>No applications have been submitted yet.</section> :
        <div style={{ display: "grid", gap: 14 }}>{applications.map(item => <article key={item.id} style={{ background: "white", border: "1px solid #e8ecf2", borderRadius: 13, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div><h2 style={{ fontSize: 18, margin: "0 0 5px" }}>{item.business_name}</h2><p style={{ color: "#667085", fontSize: 12, margin: 0 }}>{item.business_type} · Submitted {new Date(item.created_at).toLocaleString("en-KE")}</p></div>
            <span style={{ alignSelf: "start", borderRadius: 20, padding: "5px 10px", background: item.status === "pending" ? "#fff5dc" : item.status === "approved" ? "#e8f8ee" : "#fff0f0", color: item.status === "pending" ? "#946200" : item.status === "approved" ? "#176b3a" : "#a52d2d", fontSize: 11, fontWeight: 700 }}>{item.status.toUpperCase()}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, margin: "16px 0", fontSize: 13 }}>
            <div><b>Owner</b><br />{item.owner_name}</div><div><b>Email</b><br />{item.email}</div><div><b>Phone</b><br />{item.phone}</div><div><b>Location</b><br />{item.location}</div>
          </div>
          {item.status === "pending" ? <><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#344054" }}>Admin notes (optional)<textarea value={notes[item.id] || ""} onChange={e => setNotes(current => ({ ...current, [item.id]: e.target.value }))} rows={2} maxLength={1000} style={{ boxSizing: "border-box", width: "100%", marginTop: 6, padding: 10, border: "1px solid #dce2eb", borderRadius: 8 }} /></label>
            <div style={{ display: "flex", gap: 9, marginTop: 12, flexWrap: "wrap" }}>
              <button disabled={!!working} onClick={() => void review(item, "approve")} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: 0, borderRadius: 8, background: "#176b3a", color: "white", padding: "10px 14px", fontWeight: 700 }}><CheckCircle2 size={16} />{working === item.id ? "Processing..." : "Approve & invite"}</button>
              <button disabled={!!working} onClick={() => void review(item, "reject")} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #e5bcbc", borderRadius: 8, background: "white", color: "#a52d2d", padding: "10px 14px", fontWeight: 700 }}><XCircle size={16} />Reject</button>
            </div>
          </> : item.admin_notes ? <p style={{ color: "#667085", fontSize: 12 }}>Admin notes: {item.admin_notes}</p> : null}
        </article>)}</div>}
    </div>
  </main>;
}