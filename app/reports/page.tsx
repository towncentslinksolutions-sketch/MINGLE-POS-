"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, RefreshCw, TrendingUp, Receipt, Wallet, Package } from "lucide-react";
import { createClient } from "../../lib/supabase/client";

type Sale = { id: string; receipt_number: string; total: number; payment_method: string; status: string; created_at: string; user_id: string };
type Item = { product_name: string; quantity: number; line_total: number; sale_id: string };
const money = (n: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(n || 0);

export default function ReportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("30");
  const [role, setRole] = useState("");
  const [allowed, setAllowed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) { setError("Please sign in to view reports."); setLoading(false); return; }
    const { data: ownerId, error: ownerError } = await supabase.rpc("current_business_owner_id");
    if (ownerError || !ownerId) { setError(ownerError?.message || "This account is not linked to a business."); setLoading(false); return; }
    const { data: member, error: memberError } = await supabase.from("business_memberships").select("role").eq("owner_id", ownerId).eq("user_id", user.id).eq("active", true).maybeSingle();
    if (memberError || !member) { setError(memberError?.message || "No active business membership found."); setLoading(false); return; }
    setRole(member.role);
    if (member.role === "cashier") { setAllowed(false); setError("Reports are restricted to owners and managers."); setLoading(false); return; }
    setAllowed(true);
    const { data: memberships, error: membershipsError } = await supabase.from("business_memberships").select("user_id").eq("owner_id", ownerId).eq("active", true);
    if (membershipsError) { setError(membershipsError.message); setLoading(false); return; }
    const businessUserIds = [...new Set([ownerId, ...(memberships || []).map(m => m.user_id)])];
    const from = new Date(); from.setDate(from.getDate() - Number(range)); from.setHours(0, 0, 0, 0);
    const { data, error: salesError } = await supabase.from("sales").select("id, receipt_number, total, payment_method, status, created_at, user_id").in("user_id", businessUserIds).gte("created_at", from.toISOString()).order("created_at", { ascending: false });
    if (salesError) { setError(salesError.message); setLoading(false); return; }
    const saleRows = (data || []) as Sale[];
    setSales(saleRows);
    if (saleRows.length) {
      const { data: itemRows, error: itemError } = await supabase.from("sale_items").select("sale_id, product_name, quantity, line_total").in("sale_id", saleRows.map(s => s.id));
      if (itemError) setError(itemError.message); else setItems((itemRows || []) as Item[]);
    } else setItems([]);
    setLoading(false);
  }, [supabase, range]);

  useEffect(() => { void load(); }, [load]);
  const completed = sales.filter(s => s.status === "completed");
  const revenue = completed.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const paymentTotals = completed.reduce<Record<string, number>>((acc, s) => { const key = (s.payment_method || "unknown").toLowerCase(); acc[key] = (acc[key] || 0) + Number(s.total || 0); return acc; }, {});
  const topProducts = Object.values(items.reduce<Record<string, { name: string; quantity: number; revenue: number }>>((acc, item) => { const key = item.product_name || "Product"; acc[key] ||= { name: key, quantity: 0, revenue: 0 }; acc[key].quantity += Number(item.quantity || 0); acc[key].revenue += Number(item.line_total || 0); return acc; }, {})).sort((a,b) => b.quantity - a.quantity).slice(0, 8);

  return <main style={{ minHeight: "100vh", background: "#f5f7fb", color: "#182230", padding: "24px 16px", fontFamily: "Inter, Arial, sans-serif" }}><div style={{ maxWidth: 1100, margin: "0 auto" }}>
    <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#635bdb", textDecoration: "none", fontSize: 13, marginBottom: 24 }}><ArrowLeft size={17}/> Back to dashboard</Link>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}><div><div style={{ color: "#635bdb", fontSize: 11, fontWeight: 700, letterSpacing: 1.3 }}>BUSINESS PERFORMANCE</div><h1 style={{ fontSize: 28, margin: "8px 0" }}>Reports</h1><p style={{ color: "#778294", fontSize: 13, margin: 0 }}>Sales and product performance from your recorded transactions.</p></div><div style={{ display: "flex", gap: 9 }}><select value={range} onChange={e => setRange(e.target.value)} style={{ border: "1px solid #e1e5ed", background: "white", borderRadius: 8, padding: "10px 12px" }}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select><button onClick={() => void load()} aria-label="Refresh reports" style={{ border: "1px solid #e5e8ef", background: "white", borderRadius: 8, padding: 10 }}><RefreshCw size={17}/></button></div></header>
    {error && <div role="alert" style={{ background: "#fff0f0", color: "#a52d2d", borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 16 }}>{error}</div>}
    {allowed && <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14, marginBottom: 18 }}>
        <div style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 12, padding: 20 }}><TrendingUp color="#635bdb"/><p style={{ color: "#778294", fontSize: 12 }}>Completed sales revenue</p><h2 style={{ margin: 0 }}>{loading ? "—" : money(revenue)}</h2></div>
        <div style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 12, padding: 20 }}><Receipt color="#635bdb"/><p style={{ color: "#778294", fontSize: 12 }}>Completed transactions</p><h2 style={{ margin: 0 }}>{loading ? "—" : completed.length}</h2></div>
        <div style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 12, padding: 20 }}><Wallet color="#635bdb"/><p style={{ color: "#778294", fontSize: 12 }}>Average transaction</p><h2 style={{ margin: 0 }}>{loading ? "—" : money(completed.length ? revenue / completed.length : 0)}</h2></div>
        <div style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 12, padding: 20 }}><Package color="#635bdb"/><p style={{ color: "#778294", fontSize: 12 }}>Items sold</p><h2 style={{ margin: 0 }}>{loading ? "—" : items.reduce((sum, i) => sum + Number(i.quantity || 0), 0)}</h2></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
        <section style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 12, padding: 20 }}><h2 style={{ fontSize: 16, marginTop: 0 }}>Payment methods</h2>{loading ? <p>Loading...</p> : Object.keys(paymentTotals).length === 0 ? <p style={{ color: "#778294", fontSize: 13 }}>No completed sales in this period.</p> : Object.entries(paymentTotals).map(([method, total]) => <div key={method} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #edf0f5", fontSize: 13 }}><span style={{ textTransform: "capitalize" }}>{method}</span><strong>{money(total)}</strong></div>)}</section>
        <section style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 12, padding: 20 }}><h2 style={{ fontSize: 16, marginTop: 0 }}>Top-selling products</h2>{loading ? <p>Loading...</p> : topProducts.length === 0 ? <p style={{ color: "#778294", fontSize: 13 }}>No product sales in this period.</p> : topProducts.map(p => <div key={p.name} style={{ padding: "11px 0", borderBottom: "1px solid #edf0f5" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}><strong>{p.name}</strong><strong>{p.quantity} sold</strong></div><small style={{ color: "#778294" }}>{money(p.revenue)} revenue</small></div>)}</section>
      </div>
      <section style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 12, padding: 20, marginTop: 16 }}><h2 style={{ fontSize: 16, marginTop: 0 }}>Sales transactions</h2>{loading ? <p>Loading transactions...</p> : sales.length === 0 ? <p style={{ color: "#778294", fontSize: 13 }}>No transactions found for this period.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620, textAlign: "left" }}><thead><tr style={{ background: "#f8f9fc", color: "#8490a2", fontSize: 11, textTransform: "uppercase" }}><th style={{ padding: 12 }}>Receipt</th><th style={{ padding: 12 }}>Date</th><th style={{ padding: 12 }}>Payment</th><th style={{ padding: 12 }}>Amount</th><th style={{ padding: 12 }}>Status</th></tr></thead><tbody>{sales.map(s => <tr key={s.id} style={{ borderBottom: "1px solid #e9edf3", fontSize: 13 }}><td style={{ padding: 13 }}>{s.receipt_number}</td><td style={{ padding: 13 }}>{new Date(s.created_at).toLocaleString("en-KE")}</td><td style={{ padding: 13, textTransform: "capitalize" }}>{s.payment_method}</td><td style={{ padding: 13 }}>{money(Number(s.total))}</td><td style={{ padding: 13 }}>{s.status}</td></tr>)}</tbody></table></div>}</section>
      <p style={{ color: "#929bad", fontSize: 11, marginTop: 14 }}>Showing records from the last {range} days. Revenue includes completed transactions only.</p>
    </>}
  </div></main>;
}
