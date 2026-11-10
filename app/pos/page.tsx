"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Plus, Minus, Trash2, ShoppingCart, RefreshCw, CheckCircle2 } from "lucide-react";
import { createClient } from "../../lib/supabase/client";

type Product = { id: string; name: string; selling_price: number; stock_quantity: number };
type Customer = { id: string; full_name: string; phone: string | null };
type CartItem = Product & { quantity: number };
type Receipt = { receipt_number: string; total: number; amount_paid: number; change_due: number };

const money = (value: number) => new Intl.NumberFormat("en-KE", {
  style: "currency", currency: "KES", maximumFractionDigits: 2
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
    const [productResult, customerResult] = await Promise.all([
      supabase.from("products").select("id, name, selling_price, stock_quantity")
        .eq("user_id", businessId).order("name"),
      supabase.from("customers").select("id, full_name, phone")
        .eq("user_id", businessId).order("full_name").limit(500)
    ]);
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
    setReceipt({
      receipt_number: data.receipt_number,
      total: Number(data.total),
      amount_paid: Number(data.amount_paid),
      change_due: Number(data.change_due)
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

        {receipt && <section style={{ background: "#effaf3", border: "1px solid #ccebd6", borderRadius: 12, padding: 17, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#176b3a", fontWeight: 700 }}><CheckCircle2 size={20}/> Sale completed successfully</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginTop: 13, fontSize: 13 }}>
            <div><span style={{ color: "#547461" }}>Receipt</span><strong style={{ display: "block", marginTop: 4 }}>{receipt.receipt_number}</strong></div>
            <div><span style={{ color: "#547461" }}>Total</span><strong style={{ display: "block", marginTop: 4 }}>{money(receipt.total)}</strong></div>
            <div><span style={{ color: "#547461" }}>Cash received</span><strong style={{ display: "block", marginTop: 4 }}>{money(receipt.amount_paid)}</strong></div>
            <div><span style={{ color: "#547461" }}>Change</span><strong style={{ display: "block", marginTop: 4 }}>{money(receipt.change_due)}</strong></div>
          </div>
          <button onClick={() => setReceipt(null)} style={{ marginTop: 12, border: "1px solid #b9ddc6", background: "white", color: "#176b3a", borderRadius: 7, padding: "8px 12px" }}>Start next sale</button>
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
                  <div style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 13 }}>{product.name}</strong><span style={{ display: "block", color: "#635bdb", fontSize: 13, marginTop: 4 }}>{money(product.selling_price)}</span><span style={{ color: "#8490a2", fontSize: 11 }}>Stock: {product.stock_quantity}</span></div>
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
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ fontSize: 13 }}>{item.name}</strong><strong style={{ fontSize: 13 }}>{money(item.selling_price * item.quantity)}</strong></div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}>
                    <span style={{ color: "#8490a2", fontSize: 11 }}>{money(item.selling_price)} each</span>
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
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, marginBottom: 14 }}><span>Total</span><span>{money(total)}</span></div>
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
