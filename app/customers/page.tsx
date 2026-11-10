"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Plus, Search, Pencil, Trash2, X, RefreshCw } from "lucide-react";
import { createClient } from "../../lib/supabase/client";

type Customer = { id: string; full_name: string; phone: string | null; email: string | null; created_at: string };
const fieldStyle = { width: "100%", padding: 12, border: "1px solid #dfe4ec", borderRadius: 8, marginBottom: 14, background: "white" } as const;

export default function CustomersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Customer[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (authError || !user) { setError("Please sign in to view customers."); setLoading(false); return; }
    const { data: businessId, error: ownerError } = await supabase.rpc("current_business_owner_id");
    if (ownerError || !businessId) { setError(ownerError?.message || "This account is not linked to a business."); setLoading(false); return; }
    setOwnerId(businessId);
    const { data: member, error: memberError } = await supabase.from("business_memberships").select("role").eq("owner_id", businessId).eq("user_id", user.id).eq("active", true).maybeSingle();
    if (memberError || !member) { setError(memberError?.message || "No active business membership found."); setLoading(false); return; }
    setCanManage(member.role === "owner" || member.role === "manager");
    const { data, error: queryError } = await supabase.from("customers").select("id, full_name, phone, email, created_at").eq("user_id", businessId).order("created_at", { ascending: false });
    if (queryError) setError(queryError.message); else setRows((data || []) as Customer[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  function openNew() { setEditing(null); setName(""); setPhone(""); setEmail(""); setShowForm(true); }
  function openEdit(row: Customer) { setEditing(row); setName(row.full_name); setPhone(row.phone || ""); setEmail(row.email || ""); setShowForm(true); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ownerId || !name.trim()) return;
    setSaving(true); setError("");
    const values = { full_name: name.trim(), phone: phone.trim() || null, email: email.trim() || null };
    const result = editing
      ? await supabase.from("customers").update(values).eq("id", editing.id).eq("user_id", ownerId)
      : await supabase.from("customers").insert({ ...values, user_id: ownerId });
    if (result.error) setError(result.error.message);
    else { setShowForm(false); await load(); }
    setSaving(false);
  }

  async function remove(row: Customer) {
    if (!ownerId || !window.confirm("Delete " + row.full_name + "?")) return;
    const { error: removeError } = await supabase.from("customers").delete().eq("id", row.id).eq("user_id", ownerId);
    if (removeError) setError(removeError.message); else await load();
  }

  const filtered = rows.filter((r) => [r.full_name, r.phone || "", r.email || ""].join(" ").toLowerCase().includes(search.toLowerCase()));

  return <main style={{ minHeight: "100vh", background: "#f5f7fb", color: "#182230", padding: "24px 16px", fontFamily: "Inter, Arial, sans-serif" }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#635bdb", textDecoration: "none", fontSize: 13, marginBottom: 24 }}><ArrowLeft size={17}/> Back to dashboard</Link>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div><div style={{ color: "#635bdb", fontSize: 11, fontWeight: 700, letterSpacing: 1.3 }}>CUSTOMER MANAGEMENT</div><h1 style={{ fontSize: 28, margin: "8px 0" }}>Customers</h1><p style={{ color: "#778294", fontSize: 13, margin: 0 }}>Shared customer records for your business.</p></div>
        <button onClick={openNew} style={{ border: 0, borderRadius: 9, background: "#635bdb", color: "white", padding: "12px 16px", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}><Plus size={17}/> Add customer</button>
      </header>
      <section style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 13, padding: 18 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, background: "#f5f6fa", borderRadius: 8, padding: "10px 12px", flex: 1 }}><Search size={17} color="#8791a2"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone or email..." style={{ border: 0, outline: 0, background: "transparent", width: "100%", fontSize: 13 }}/></div>
          <button onClick={() => void load()} aria-label="Refresh customers" style={{ border: "1px solid #e5e8ef", background: "white", borderRadius: 8, padding: 10 }}><RefreshCw size={17}/></button>
        </div>
        {error && <div role="alert" style={{ background: "#fff0f0", color: "#a52d2d", borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 16 }}>{error}</div>}
        {loading ? <p style={{ padding: 35, textAlign: "center", color: "#778294" }}>Loading customers...</p> : filtered.length === 0 ? <div style={{ textAlign: "center", padding: "42px 12px" }}><Users size={34} color="#929bad"/><h3>{search ? "No matching customers" : "No customers yet"}</h3><p style={{ color: "#778294", fontSize: 13 }}>Add a customer to build your customer list.</p><button onClick={openNew} style={{ border: 0, background: "#635bdb", color: "white", borderRadius: 8, padding: "10px 14px" }}>Add customer</button></div> :
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 580, textAlign: "left" }}><thead><tr style={{ background: "#f8f9fc", color: "#8490a2", fontSize: 11, textTransform: "uppercase" }}><th style={{ padding: 13 }}>Customer</th><th style={{ padding: 13 }}>Phone</th><th style={{ padding: 13 }}>Email</th><th style={{ padding: 13 }}>Added</th><th style={{ padding: 13, textAlign: "right" }}>Actions</th></tr></thead><tbody>{filtered.map(row => <tr key={row.id} style={{ borderBottom: "1px solid #e9edf3", fontSize: 13 }}><td style={{ padding: 14, fontWeight: 600 }}>{row.full_name}</td><td style={{ padding: 14 }}>{row.phone || "—"}</td><td style={{ padding: 14 }}>{row.email || "—"}</td><td style={{ padding: 14 }}>{new Date(row.created_at).toLocaleDateString("en-KE")}</td><td style={{ padding: 14, textAlign: "right", whiteSpace: "nowrap" }}><button onClick={() => openEdit(row)} aria-label="Edit customer" style={{ border: "1px solid #e5e8ef", background: "white", borderRadius: 7, padding: 8, marginRight: 7, color: "#635bdb" }}><Pencil size={15}/></button>{canManage && <button onClick={() => void remove(row)} aria-label="Delete customer" style={{ border: "1px solid #f1dada", background: "white", borderRadius: 7, padding: 8, color: "#c34444" }}><Trash2 size={15}/></button>}</td></tr>)}</tbody></table></div>}
        <div style={{ color: "#929bad", fontSize: 11, marginTop: 15 }}>{rows.length} customer{rows.length === 1 ? "" : "s"} registered</div>
      </section>
    </div>
    {showForm && <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,20,35,.48)", display: "grid", placeItems: "center", padding: 16, zIndex: 20 }}><form onSubmit={save} onClick={e => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 440, borderRadius: 14, padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}><h2 style={{ margin: 0, fontSize: 19 }}>{editing ? "Edit customer" : "Add customer"}</h2><button type="button" onClick={() => setShowForm(false)} aria-label="Close form" style={{ border: 0, background: "transparent" }}><X size={20}/></button></div><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Full name</label><input required value={name} onChange={e => setName(e.target.value)} placeholder="Customer name" style={fieldStyle}/><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Phone number</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07..." style={fieldStyle}/><label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Email (optional)</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" style={fieldStyle}/><button disabled={saving} type="submit" style={{ width: "100%", border: 0, borderRadius: 8, padding: 13, background: "#635bdb", color: "white", fontWeight: 700 }}>{saving ? "Saving..." : editing ? "Save changes" : "Save customer"}</button></form></div>}
  </main>;
}
