"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Plus, RefreshCw, Search, X, ShoppingBag, Truck } from "lucide-react";
import { createClient } from "../../lib/supabase/client";

type Product = { id: string; name: string; selling_price: number; cost_price?: number };
type Line = { product_id: string; product_name: string; quantity: string; price: string };
type Order = { id: string; order_number: string; customer_name?: string; supplier_name?: string; status: string; payment_status: string; total: number; created_at: string; expected_date?: string | null };
type Tab = "customer" | "supplier";
const money = (n: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(Number(n || 0));
const inputStyle: React.CSSProperties = { width: "100%", border: "1px solid #dfe4ed", borderRadius: 8, padding: "11px 12px", background: "white", color: "#182230", fontSize: 13 };
const buttonStyle: React.CSSProperties = { border: 0, borderRadius: 8, background: "#635bdb", color: "white", padding: "11px 15px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 7 };

export default function OrdersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [ownerId, setOwnerId] = useState("");
  const [tab, setTab] = useState<Tab>("customer");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [partyName, setPartyName] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", product_name: "", quantity: "1", price: "" }]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setError("Please sign in to use Orders."); setLoading(false); return; }
    const { data: owner, error: ownerError } = await supabase.rpc("current_business_owner_id");
    if (ownerError || !owner) { setError(ownerError?.message || "Your account is not linked to a business."); setLoading(false); return; }
    setOwnerId(owner);
    const [ordersResult, productsResult] = await Promise.all([
      tab === "customer"
        ? supabase.from("customer_orders").select("*").eq("owner_id", owner).order("created_at", { ascending: false }).limit(200)
        : supabase.from("supplier_orders").select("*").eq("owner_id", owner).order("created_at", { ascending: false }).limit(200),
      supabase.from("products").select("id,name,selling_price,cost_price").eq("user_id", owner).order("name")
    ]);
    if (ordersResult.error) setError(ordersResult.error.message);
    else setOrders((ordersResult.data || []) as Order[]);
    if (productsResult.error) setError((v) => v || productsResult.error.message);
    else setProducts((productsResult.data || []) as Product[]);
    setLoading(false);
  }, [supabase, tab]);

  useEffect(() => { void load(); }, [load]);

  function openForm() {
    setPartyName(""); setPartyPhone(""); setExpectedDate(""); setNotes(""); setPaymentStatus("unpaid");
    setLines([{ product_id: "", product_name: "", quantity: "1", price: "" }]);
    setShowForm(true); setError("");
  }
  function chooseProduct(index: number, id: string) {
    const product = products.find((p) => p.id === id);
    setLines((old) => old.map((line, i) => i === index ? {
      ...line, product_id: id, product_name: product?.name || "",
      price: String(tab === "customer" ? product?.selling_price ?? "" : product?.cost_price ?? "")
    } : line));
  }
  function updateLine(index: number, key: keyof Line, value: string) {
    setLines((old) => old.map((line, i) => i === index ? { ...line, [key]: value } : line));
  }
  const total = lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity)) * Math.max(0, Number(line.price)), 0);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ownerId || !partyName.trim()) { setError(tab === "customer" ? "Enter the customer name." : "Enter the supplier name."); return; }
    const valid = lines.filter((l) => l.product_name.trim() && Number(l.quantity) > 0 && Number(l.price) >= 0 && Number.isFinite(Number(l.quantity)) && Number.isFinite(Number(l.price)));
    if (!valid.length || valid.length !== lines.length) { setError("Add at least one valid item, quantity and price."); return; }
    setSaving(true); setError("");
    const stamp = Date.now().toString().slice(-9);
    const orderNumber = (tab === "customer" ? "CO-" : "PO-") + stamp;
    const header = tab === "customer" ? {
      owner_id: ownerId, order_number: orderNumber, customer_name: partyName.trim(), customer_phone: partyPhone.trim(),
      status: "pending", payment_status: paymentStatus, total, notes: notes.trim()
    } : {
      owner_id: ownerId, order_number: orderNumber, supplier_name: partyName.trim(), supplier_phone: partyPhone.trim(),
      status: "draft", payment_status: paymentStatus, total, expected_date: expectedDate || null, notes: notes.trim()
    };
    const table = tab === "customer" ? "customer_orders" : "supplier_orders";
    const { data: created, error: createError } = await supabase.from(table).insert(header as any).select("id").single();
    if (createError || !created) { setError(createError?.message || "Order could not be created."); setSaving(false); return; }
    const itemRows = valid.map((l) => tab === "customer" ? {
      order_id: created.id, product_id: l.product_id || null, product_name: l.product_name.trim(),
      quantity: Number(l.quantity), unit_price: Number(l.price), line_total: Number(l.quantity) * Number(l.price)
    } : {
      order_id: created.id, product_id: l.product_id || null, product_name: l.product_name.trim(),
      quantity: Number(l.quantity), unit_cost: Number(l.price), line_total: Number(l.quantity) * Number(l.price)
    });
    const { error: itemsError } = await supabase.from(tab === "customer" ? "customer_order_items" : "supplier_order_items").insert(itemRows);
    if (itemsError) {
      await supabase.from(table).delete().eq("id", created.id);
      setError(itemsError.message); setSaving(false); return;
    }
    setShowForm(false); setSaving(false); await load();
  }

  async function updateStatus(order: Order, status: string) {
    const table = tab === "customer" ? "customer_orders" : "supplier_orders";
    const { error: updateError } = await supabase.from(table).update({ status, updated_at: new Date().toISOString() }).eq("id", order.id).eq("owner_id", ownerId);
    if (updateError) setError(updateError.message); else await load();
  }
  async function updatePayment(order: Order, payment_status: string) {
    const table = tab === "customer" ? "customer_orders" : "supplier_orders";
    const { error: updateError } = await supabase.from(table).update({ payment_status, updated_at: new Date().toISOString() }).eq("id", order.id).eq("owner_id", ownerId);
    if (updateError) setError(updateError.message); else await load();
  }
  const filtered = orders.filter((o) => [o.order_number, o.customer_name || "", o.supplier_name || "", o.status].join(" ").toLowerCase().includes(search.toLowerCase()));

  return <main style={{ minHeight: "100vh", background: "#f5f7fb", color: "#182230", padding: "22px 14px", fontFamily: "Inter,Arial,sans-serif" }}>
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#635bdb", textDecoration: "none", fontSize: 13, marginBottom: 20 }}><ArrowLeft size={17}/> Back to dashboard</Link>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <div><div style={{ color: "#635bdb", fontSize: 11, fontWeight: 800, letterSpacing: 1.3 }}>MINGLE POS WORKSPACE</div><h1 style={{ fontSize: 28, margin: "7px 0" }}>Orders</h1><p style={{ color: "#778294", fontSize: 13, margin: 0 }}>Manage customer orders and supplier purchase orders in one place.</p></div>
        <button onClick={openForm} style={buttonStyle}><Plus size={17}/> {tab === "customer" ? "New customer order" : "New supplier order"}</button>
      </header>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 17 }}>
        <button onClick={() => setTab("customer")} style={{ ...buttonStyle, background: tab === "customer" ? "#635bdb" : "white", color: tab === "customer" ? "white" : "#596579", border: "1px solid #e2e6ee" }}><ShoppingBag size={16}/> Customer orders</button>
        <button onClick={() => setTab("supplier")} style={{ ...buttonStyle, background: tab === "supplier" ? "#635bdb" : "white", color: tab === "supplier" ? "white" : "#596579", border: "1px solid #e2e6ee" }}><Truck size={16}/> Supplier orders</button>
        <button onClick={() => void load()} disabled={loading} aria-label="Refresh orders" style={{ marginLeft: "auto", border: "1px solid #e2e6ee", background: "white", color: "#596579", borderRadius: 8, padding: 10 }}><RefreshCw size={16}/></button>
      </div>
      {error && <div role="alert" style={{ background: "#fff0f0", color: "#a52d2d", borderRadius: 9, padding: 12, fontSize: 13, marginBottom: 15 }}>{error}</div>}
      <section style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 13, padding: 17 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, maxWidth: 390, background: "#f5f6fa", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}><Search size={17} color="#8791a2"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders..." style={{ border: 0, outline: 0, background: "transparent", width: "100%", fontSize: 13 }}/></div>
        {loading ? <p style={{ textAlign: "center", padding: 35, color: "#778294" }}>Loading orders...</p> : !filtered.length ? <div style={{ textAlign: "center", padding: "42px 12px", color: "#778294" }}><ClipboardList size={34}/><h3 style={{ color: "#182230" }}>No {tab === "customer" ? "customer" : "supplier"} orders yet</h3><p style={{ fontSize: 13 }}>Create your first order to start tracking it here.</p><button onClick={openForm} style={buttonStyle}><Plus size={16}/> Create order</button></div> :
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760, textAlign: "left" }}>
          <thead><tr style={{ background: "#f8f9fc", color: "#8490a2", fontSize: 11, textTransform: "uppercase" }}><th style={{ padding: 12 }}>Order</th><th style={{ padding: 12 }}>{tab === "customer" ? "Customer" : "Supplier"}</th><th style={{ padding: 12 }}>Date</th><th style={{ padding: 12 }}>Total</th><th style={{ padding: 12 }}>Status</th><th style={{ padding: 12 }}>Payment</th></tr></thead>
          <tbody>{filtered.map((o) => <tr key={o.id} style={{ borderBottom: "1px solid #e9edf3", fontSize: 13 }}>
            <td style={{ padding: 13, fontWeight: 700 }}>{o.order_number}</td><td style={{ padding: 13 }}>{o.customer_name || o.supplier_name}</td><td style={{ padding: 13 }}>{new Date(o.created_at).toLocaleDateString("en-KE")}</td><td style={{ padding: 13 }}>{money(o.total)}</td>
            <td style={{ padding: 10 }}><select aria-label="Order status" value={o.status} onChange={(e) => void updateStatus(o, e.target.value)} style={{ ...inputStyle, minWidth: 150, padding: 8 }}>{(tab === "customer" ? [["pending","Pending"],["confirmed","Confirmed"],["processing","Processing"],["ready","Ready"],["completed","Completed"],["cancelled","Cancelled"]] : [["draft","Draft"],["placed","Placed"],["partially_received","Partially received"],["received","Received"],["cancelled","Cancelled"]]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></td>
            <td style={{ padding: 10 }}><select aria-label="Payment status" value={o.payment_status} onChange={(e) => void updatePayment(o, e.target.value)} style={{ ...inputStyle, minWidth: 110, padding: 8 }}><option value="unpaid">Unpaid</option><option value="partial">Partial</option><option value="paid">Paid</option></select></td>
          </tr>)}</tbody></table></div>}
        <div style={{ color: "#929bad", fontSize: 11, marginTop: 14 }}>{filtered.length} order{filtered.length === 1 ? "" : "s"} shown</div>
      </section>
    </div>

    {showForm && <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(15,20,35,.5)", display: "grid", placeItems: "center", padding: 14, overflowY: "auto" }}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 620, maxHeight: "94vh", overflowY: "auto", borderRadius: 14, padding: 21, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}><h2 style={{ margin: 0, fontSize: 19 }}>{tab === "customer" ? "Create customer order" : "Create supplier purchase order"}</h2><button type="button" onClick={() => setShowForm(false)} aria-label="Close form" style={{ border: 0, background: "transparent", color: "#778294" }}><X size={20}/></button></div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{tab === "customer" ? "Customer name *" : "Supplier name *"}</label><input required value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder={tab === "customer" ? "Customer or company name" : "Supplier or vendor name"} style={{ ...inputStyle, marginBottom: 13 }}/>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Phone number</label><input value={partyPhone} onChange={(e) => setPartyPhone(e.target.value)} placeholder="Phone number" style={{ ...inputStyle, marginBottom: 13 }}/>
        {tab === "supplier" && <><label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Expected delivery date</label><input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} style={{ ...inputStyle, marginBottom: 13 }}/></>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 0 10px" }}><strong style={{ fontSize: 13 }}>Order items</strong><button type="button" onClick={() => setLines((v) => [...v, { product_id: "", product_name: "", quantity: "1", price: "" }])} style={{ border: "1px solid #dedcf8", color: "#635bdb", background: "white", borderRadius: 7, padding: "7px 10px", fontSize: 12 }}><Plus size={14}/> Add item</button></div>
        {lines.map((line, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(65px,.7fr) minmax(90px,1fr) auto", gap: 7, marginBottom: 9, alignItems: "center" }}>
          <select value={line.product_id} onChange={(e) => chooseProduct(i, e.target.value)} style={inputStyle}><option value="">Choose product…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input aria-label="Quantity" type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} style={inputStyle}/>
          <input aria-label={tab === "customer" ? "Unit price" : "Unit cost"} type="number" min="0" step="0.01" value={line.price} onChange={(e) => updateLine(i, "price", e.target.value)} placeholder={tab === "customer" ? "Unit price" : "Unit cost"} style={inputStyle}/>
          <button type="button" aria-label="Remove item" disabled={lines.length === 1} onClick={() => setLines((v) => v.filter((_, n) => n !== i))} style={{ border: 0, background: "transparent", color: "#c34444", padding: 6 }}><X size={17}/></button>
          {!line.product_id && <input value={line.product_name} onChange={(e) => updateLine(i, "product_name", e.target.value)} placeholder="Item name" style={{ ...inputStyle, gridColumn: "1 / -1" }}/>}
        </div>)}
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, margin: "13px 0 6px" }}>Payment status</label><select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} style={{ ...inputStyle, marginBottom: 13 }}><option value="unpaid">Unpaid</option><option value="partial">Partially paid</option><option value="paid">Paid</option></select>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional order notes" style={{ ...inputStyle, resize: "vertical" }}/>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e9edf3", marginTop: 17, paddingTop: 15 }}><strong>Order total</strong><strong style={{ fontSize: 19, color: "#635bdb" }}>{money(total)}</strong></div>
        <button type="submit" disabled={saving} style={{ ...buttonStyle, width: "100%", justifyContent: "center", marginTop: 16, opacity: saving ? .65 : 1 }}>{saving ? "Saving order…" : "Save order"}</button>
      </form>
    </div>}
  </main>;
}
