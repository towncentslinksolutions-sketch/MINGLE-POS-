"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Plus, Minus, Trash2, ShoppingCart, RefreshCw, CheckCircle2, Printer } from "lucide-react";
import { createClient } from "../../lib/supabase/client";

type Product = { id: string; name: string; selling_price: number; stock_quantity: number };
type Customer = { id: string; full_name: string; phone: string | null };
type CartItem = Product & { quantity: number };
type BusinessReceiptSettings = {
  business_name?: string; logo_url?: string; business_phone?: string; business_email?: string;
  business_address?: string; support_phone?: string; support_email?: string;
  receipt_footer?: string; return_policy?: string; currency?: string;
};
type ReceiptItem = { id: string; name: string; quantity: number; selling_price: number };
type Receipt = {
  receipt_number: string; total: number; amount_paid: number; change_due: number;
  items: ReceiptItem[]; customer_name: string; customer_phone: string;
  sold_at: string; settings: BusinessReceiptSettings;
};

const money = (value: number, currency = "KES") => new Intl.NumberFormat("en-KE", {
  style: "currency", currency: /^[A-Z]{3}$/.test(currency) ? currency : "KES", maximumFractionDigits: 2
}).format(Number(value || 0));

const field: React.CSSProperties = {
  width: "100%", padding: "11px 12px", border: "1px solid #dfe4ec",
  borderRadius: 8, background: "white", color: "#182230", fontSize: 14
};

export default function PosPage() {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [businessSettings, setBusinessSettings] = useState<BusinessReceiptSettings>({});
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      setError("Please sign in to use the Point of Sale.");
      setLoading(false);
      return;
    }
    const { data: businessId, error: ownerError } = await supabase.rpc("current_business_owner_id");
    if (ownerError || !businessId) {
      setError(ownerError?.message || "This account is not linked to a business.");
      setLoading(false);
      return;
    }
    const { data: membership, error: memberError } = await supabase
      .from("business_memberships").select("role")
      .eq("owner_id", businessId).eq("user_id", session.user.id)
      .eq("active", true).maybeSingle();
    if (memberError || !membership) {
      setError(memberError?.message || "Your business membership is inactive.");
      setLoading(false);
      return;
    }
    setOwnerId(businessId);
    const [productResult, customerResult, settingsResponse] = await Promise.all([
      supabase.from("products").select("id, name, selling_price, stock_quantity")
        .eq("user_id", businessId).order("name"),
      supabase.from("customers").select("id, full_name, phone")
        .eq("user_id", businessId).order("full_name").limit(500),
      fetch("/api/receipt-settings")
    ]);
    let loadedSettings: BusinessReceiptSettings = {};
    try {
      const settingsData = await settingsResponse.json();
      if (settingsResponse.ok && settingsData.settings) loadedSettings = settingsData.settings;
    } catch { /* Keep a basic receipt if settings cannot be loaded. */ }
    setBusinessSettings(loadedSettings);
    if (productResult.error) setError(productResult.error.message);
    else setProducts((productResult.data || []) as Product[]);
    if (customerResult.error) setError((previous) => previous || customerResult.error.message);
    else setCustomers((customerResult.data || []) as Customer[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const total = cart.reduce((sum, item) => sum + Number(item.selling_price) * item.quantity, 0);
  const filtered = products.filter((product) =>
    product.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  function addProduct(product: Product) {
    setError("");
    setReceipt(null);
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          setError("You cannot add more than the available stock.");
          return current;
        }
        return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      if (product.stock_quantity < 1) {
        setError("This product is out of stock.");
        return current;
      }
      return [...current, { ...product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, amount: number) {
    setCart((current) => current.map((item) => item.id === productId
      ? { ...item, quantity: Math.min(item.stock_quantity, Math.max(1, item.quantity + amount)) }
      : item));
  }

  async function completeSale() {
    if (!ownerId || cart.length === 0 || checkingOut) return;
    const paid = Number(amountPaid);
    if (!Number.isFinite(paid) || paid < total) {
      setError("Enter the full cash amount received. It cannot be less than the total.");
      return;
    }
    setCheckingOut(true);
    setError("");
    const { data, error: saleError } = await supabase.rpc("complete_pos_sale", {
      p_items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })),
      p_customer_id: customerId || null,
      p_amount_paid: paid
    });
    if (saleError) {
      setError(saleError.message);
      setCheckingOut(false);
      return;
    }
    if (!data?.success || !data?.receipt_number) {
      setError("The sale response could not be confirmed. Please check sales before retrying.");
      setCheckingOut(false);
      return;
    }
    const selectedCustomer = customers.find((customer) => customer.id === customerId);
    setReceipt({
      receipt_number: data.receipt_number,
      total: Number(data.total),
      amount_paid: Number(data.amount_paid),
      change_due: Number(data.change_due),
      items: cart.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity, selling_price: Number(item.selling_price) })),
      customer_name: selectedCustomer?.full_name || "Walk-in customer",
      customer_phone: selectedCustomer?.phone || "",
      sold_at: new Date().toISOString(),
      settings: businessSettings
    });
    setCart([]);
    setCustomerId("");
    setAmountPaid("");
    await load();
    setCheckingOut(false);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", color: "#182230", padding: "22px 14px", fontFamily: "Inter, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#635bdb", textDecoration: "none", fontSize: 13, marginBottom: 20 }}>
          <ArrowLeft size={17} /> Back to dashboard
        </Link>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <div><div style={{ color: "#635bdb", fontSize: 11, fontWeight: 700, letterSpacing: 1.3 }}>MINGLE POS</div><h1 style={{ fontSize: 28, margin: "7px 0" }}>Point of Sale</h1><p style={{ color: "#778294", fontSize: 13, margin: 0 }}>Select products, take cash and complete a sale.</p></div>
          <button onClick={() => void load()} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #e2e6ee", background: "white", borderRadius: 8, padding: "10px 13px", color: "#596579" }}><RefreshCw size={16}/> Refresh stock</button>
        </header>

        {error && <div role="alert" style={{ background: "#fff0f0", color: "#a52d2d", borderRadius: 9, padding: 12, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {receipt && <section style={{ marginBottom: 18 }}>
          <div className="no-print" style={{ background: "#effaf3", border: "1px solid #ccebd6", borderRadius: 12, padding: 17, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#176b3a", fontWeight: 700 }}><CheckCircle2 size={20}/> Sale completed successfully</div>
            <p style={{ fontSize: 13, color: "#547461" }}>Receipt {receipt.receipt_number} is ready to print.</p>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              <button onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: 0, background: "#176b3a", color: "white", borderRadius: 7, padding: "10px 14px", fontWeight: 700 }}><Printer size={16}/> Print receipt</button>
              <button onClick={() => setReceipt(null)} style={{ border: "1px solid #b9ddc6", background: "white", color: "#176b3a", borderRadius: 7, padding: "9px 12px" }}>Start next sale</button>
            </div>
          </div>
          <article className="print-receipt" style={{ width: "100%", maxWidth: 380, margin: "0 auto", background: "white", color: "#111", padding: 18, border: "1px solid #e3e3e3", fontFamily: "Arial, sans-serif", fontSize: 12 }}>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              {receipt.settings.logo_url && <img src={receipt.settings.logo_url} alt="Business logo" style={{ maxWidth: 110, maxHeight: 70, objectFit: "contain", margin: "0 auto 8px" }}/>}
              <h2 style={{ fontSize: 18, margin: "0 0 5px" }}>{receipt.settings.business_name || "MINGLE POS Store"}</h2>
              {receipt.settings.business_address && <div>{receipt.settings.business_address}</div>}
              {receipt.settings.business_phone && <div>Tel: {receipt.settings.business_phone}</div>}
              {receipt.settings.business_email && <div>{receipt.settings.business_email}</div>}
              <div style={{ fontWeight: 700, marginTop: 10 }}>SALES RECEIPT</div>
            </div>
            <div style={{ borderTop: "1px dashed #777", borderBottom: "1px dashed #777", padding: "8px 0", lineHeight: 1.7 }}>
              <div>Receipt: <strong>{receipt.receipt_number}</strong></div>
              <div>Date: {new Date(receipt.sold_at).toLocaleString("en-KE")}</div>
              <div>Customer: {receipt.customer_name}</div>
              {receipt.customer_phone && <div>Phone: {receipt.customer_phone}</div>}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", margin: "10px 0" }}>
              <thead><tr style={{ borderBottom: "1px solid #777", textAlign: "left" }}><th style={{ padding: "5px 2px" }}>Item</th><th style={{ padding: "5px 2px", textAlign: "right" }}>Qty</th><th style={{ padding: "5px 2px", textAlign: "right" }}>Price</th><th style={{ padding: "5px 2px", textAlign: "right" }}>Amount</th></tr></thead>
              <tbody>{receipt.items.map((item) => <tr key={item.id}><td style={{ padding: "6px 2px" }}>{item.name}</td><td style={{ padding: "6px 2px", textAlign: "right" }}>{item.quantity}</td><td style={{ padding: "6px 2px", textAlign: "right" }}>{money(item.selling_price, receipt.settings.currency, businessSettings.currency)}</td><td style={{ padding: "6px 2px", textAlign: "right" }}>{money(item.selling_price * item.quantity, receipt.settings.currency, businessSettings.currency)}</td></tr>)}</tbody>
            </table>
            <div style={{ borderTop: "1px dashed #777", paddingTop: 8, lineHeight: 1.8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15 }}><span>TOTAL</span><span>{money(receipt.total, receipt.settings.currency, businessSettings.currency)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Cash received</span><span>{money(receipt.amount_paid, receipt.settings.currency, businessSettings.currency)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Change</span><span>{money(receipt.change_due, receipt.settings.currency, businessSettings.currency)}</span></div>
            </div>
            {receipt.settings.receipt_footer && <div style={{ textAlign: "center", marginTop: 14, whiteSpace: "pre-wrap" }}>{receipt.settings.receipt_footer}</div>}
            {receipt.settings.return_policy && <div style={{ borderTop: "1px dashed #777", marginTop: 10, paddingTop: 8, whiteSpace: "pre-wrap" }}>Return policy: {receipt.settings.return_policy}</div>}
            <div style={{ textAlign: "center", marginTop: 14, fontSize: 10 }}>Powered by MINGLE POS</div>
          </article>
          <style jsx global>{`
            @media print {
              @page { size: 80mm auto; margin: 4mm; }
              body * { visibility: hidden !important; }
              .print-receipt, .print-receipt * { visibility: visible !important; }
              .print-receipt { position: absolute !important; left: 0 !important; top: 0 !important; width: 72mm !important; max-width: 72mm !important; margin: 0 !important; padding: 0 !important; border: 0 !important; }
              .no-print { display: none !important; }
            }
          `}</style>
        </section>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))", gap: 18, alignItems: "start" }}>
          <section style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 13, padding: 17 }}>
            <h2 style={{ fontSize: 18, margin: "0 0 14px" }}>Products</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 9, background: "#f5f6fa", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
              <Search size={17} color="#8791a2"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products..." style={{ border: 0, outline: 0, background: "transparent", width: "100%", fontSize: 13 }}/>
            </div>
            {loading ? <p style={{ color: "#778294", padding: 20, textAlign: "center" }}>Loading products...</p> :
              filtered.length === 0 ? <p style={{ color: "#778294", padding: 20, textAlign: "center" }}>No matching products found.</p> :
              <div style={{ display: "grid", gap: 9, maxHeight: 560, overflowY: "auto" }}>
                {filtered.map((product) => <div key={product.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, border: "1px solid #edf0f5", borderRadius: 9, padding: 12 }}>
                  <div style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 13 }}>{product.name}</strong><span style={{ display: "block", color: "#635bdb", fontSize: 13, marginTop: 4 }}>{money(product.selling_price, businessSettings.currency)}</span><span style={{ color: "#8490a2", fontSize: 11 }}>Stock: {product.stock_quantity}</span></div>
                  <button disabled={product.stock_quantity < 1 || loading} onClick={() => addProduct(product)} style={{ flexShrink: 0, border: 0, borderRadius: 8, background: product.stock_quantity < 1 ? "#e7e9ef" : "#635bdb", color: product.stock_quantity < 1 ? "#8992a2" : "white", padding: "9px 11px", display: "inline-flex", alignItems: "center", gap: 5 }}><Plus size={15}/> Add</button>
                </div>)}
              </div>}
          </section>

          <section style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 13, padding: 17 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}><h2 style={{ fontSize: 18, margin: 0 }}>Current sale</h2><span style={{ color: "#8490a2", fontSize: 12 }}>{cart.reduce((n, item) => n + item.quantity, 0)} item(s)</span></div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Customer (optional)</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ ...field, marginBottom: 15 }}>
              <option value="">Walk-in customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name}{customer.phone ? " · " + customer.phone : ""}</option>)}
            </select>
            {cart.length === 0 ? <div style={{ textAlign: "center", padding: "35px 10px", color: "#8490a2" }}><ShoppingCart size={30}/><p style={{ fontSize: 13 }}>Your cart is empty. Add products to begin.</p></div> :
              <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
                {cart.map((item) => <div key={item.id} style={{ borderBottom: "1px solid #edf0f5", paddingBottom: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ fontSize: 13 }}>{item.name}</strong><strong style={{ fontSize: 13 }}>{money(item.selling_price * item.quantity, businessSettings.currency)}</strong></div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}>
                    <span style={{ color: "#8490a2", fontSize: 11 }}>{money(item.selling_price, businessSettings.currency)} each</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <button aria-label="Decrease quantity" onClick={() => changeQuantity(item.id, -1)} style={{ border: "1px solid #e2e6ee", background: "white", borderRadius: 6, padding: 6 }}><Minus size={14}/></button>
                      <strong style={{ minWidth: 18, textAlign: "center", fontSize: 13 }}>{item.quantity}</strong>
                      <button aria-label="Increase quantity" disabled={item.quantity >= item.stock_quantity} onClick={() => changeQuantity(item.id, 1)} style={{ border: "1px solid #e2e6ee", background: "white", borderRadius: 6, padding: 6, opacity: item.quantity >= item.stock_quantity ? .4 : 1 }}><Plus size={14}/></button>
                      <button aria-label="Remove item" onClick={() => setCart((current) => current.filter((row) => row.id !== item.id))} style={{ border: "1px solid #f1dada", background: "white", color: "#c34444", borderRadius: 6, padding: 6, marginLeft: 3 }}><Trash2 size={14}/></button>
                    </div>
                  </div>
                </div>)}
              </div>}
            <div style={{ borderTop: "1px solid #e9edf3", paddingTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, marginBottom: 14 }}><span>Total</span><span>{money(total, businessSettings.currency)}</span></div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Cash received (KSh)</label>
              <input type="number" min={total} step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder={total ? total.toFixed(2) : "0.00"} style={{ ...field, marginBottom: 12 }}/>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#596579", fontSize: 13, marginBottom: 15 }}><span>Change due</span><strong>{money(Math.max(0, Number(amountPaid || 0) - total))}</strong></div>
              <button onClick={() => void completeSale()} disabled={checkingOut || loading || cart.length === 0} style={{ width: "100%", border: 0, borderRadius: 9, padding: 14, background: checkingOut || loading || cart.length === 0 ? "#aeb4c5" : "#635bdb", color: "white", fontWeight: 700, fontSize: 14 }}>{checkingOut ? "Completing sale..." : "Complete cash sale"}</button>
              <button onClick={() => { setCart([]); setAmountPaid(""); setError(""); }} disabled={checkingOut || cart.length === 0} style={{ width: "100%", border: "1px solid #e2e6ee", borderRadius: 9, padding: 11, background: "white", color: "#596579", marginTop: 8 }}>Clear cart</button>
              <p style={{ color: "#929bad", fontSize: 10, lineHeight: 1.5, margin: "12px 0 0" }}>Cash checkout only. Stock and sale records are updated together by the database. M-Pesa and card payments are not enabled yet.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
