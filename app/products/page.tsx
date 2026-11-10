"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Package, Plus, Search, Pencil, Trash2, X, RefreshCw } from "lucide-react";
import { createClient } from "../../lib/supabase/client";

type Product = {
  id: string;
  name: string;
  selling_price: number;
  stock_quantity: number;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(Number(value || 0));

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  const supabase = useMemo(() => createClient(), []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (authError || !user) {
      setUserId("");
      setProducts([]);
      setError("Please sign in to your MINGLE POS account to manage products.");
      setLoading(false);
      return;
    }
    const { data: ownerId, error: ownerError } = await supabase.rpc("current_business_owner_id");
    if (ownerError || !ownerId) {
      setUserId("");
      setProducts([]);
      setError(ownerError?.message || "Your account is not linked to a business.");
      setLoading(false);
      return;
    }
    setUserId(ownerId);
    const { data: membership, error: membershipError } = await supabase
      .from("business_memberships")
      .select("role")
      .eq("owner_id", ownerId)
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    if (membershipError) {
      setError(membershipError.message);
      setLoading(false);
      return;
    }
    setCanManage(membership?.role === "owner" || membership?.role === "manager");
    const { data, error: queryError } = await supabase
      .from("products")
      .select("id, name, selling_price, stock_quantity")
      .eq("user_id", ownerId)
      .order("name", { ascending: true });
    if (queryError) setError(queryError.message);
    else setProducts((data || []) as Product[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  function openNew() {
    setEditing(null);
    setName("");
    setPrice("");
    setStock("");
    setShowForm(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setName(product.name);
    setPrice(String(product.selling_price));
    setStock(String(product.stock_quantity));
    setShowForm(true);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    const selling_price = Number(price);
    const stock_quantity = Number(stock);
    if (!name.trim() || !Number.isFinite(selling_price) || selling_price < 0 ||
        !Number.isInteger(stock_quantity) || stock_quantity < 0) {
      setError("Enter a product name, a valid non-negative price, and a whole-number stock quantity.");
      return;
    }
    setSaving(true);
    setError("");
    const values = { name: name.trim(), selling_price, stock_quantity };
    const result = editing
      ? await supabase.from("products").update(values).eq("id", editing.id).eq("user_id", userId)
      : await supabase.from("products").insert({ ...values, user_id: userId });
    if (result.error) setError(result.error.message);
    else {
      setShowForm(false);
      setEditing(null);
      await loadProducts();
    }
    setSaving(false);
  }

  async function deleteProduct(product: Product) {
    if (!userId || !window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;
    const { error: deleteError } = await supabase.from("products")
      .delete().eq("id", product.id).eq("user_id", userId);
    if (deleteError) setError(deleteError.message);
    else await loadProducts();
  }

  const filtered = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", color: "#182230", padding: "24px 16px", fontFamily: "Inter, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#635bdb", textDecoration: "none", fontSize: 13, marginBottom: 24 }}>
          <ArrowLeft size={17} /> Back to dashboard
        </Link>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <div style={{ color: "#635bdb", fontSize: 11, fontWeight: 700, letterSpacing: 1.3 }}>INVENTORY MANAGEMENT</div>
            <h1 style={{ fontSize: 28, margin: "8px 0" }}>Products</h1>
            <p style={{ color: "#778294", fontSize: 13, margin: 0 }}>Add, update and track your store products.</p>
          </div>
          {canManage && <button onClick={openNew} style={{ border: 0, borderRadius: 9, background: "#635bdb", color: "white", padding: "12px 16px", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <Plus size={17} /> Add product
          </button>}
        </header>

        <section style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 13, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, background: "#f5f6fa", borderRadius: 8, padding: "10px 12px", flex: "1 1 220px", maxWidth: 380 }}>
              <Search size={17} color="#8791a2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." style={{ border: 0, outline: 0, background: "transparent", width: "100%", fontSize: 13 }} />
            </div>
            <button onClick={() => void loadProducts()} aria-label="Refresh products" style={{ border: "1px solid #e5e8ef", background: "white", borderRadius: 8, padding: 10, color: "#596579" }}><RefreshCw size={17} /></button>
          </div>

          {error && <div role="alert" style={{ background: "#fff0f0", color: "#a52d2d", borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 16 }}>{error}</div>}

          {loading ? <p style={{ padding: 35, textAlign: "center", color: "#778294" }}>Loading products...</p> :
            !userId ? <div style={{ textAlign: "center", padding: "42px 12px" }}><Package size={34} color="#929bad" /><p style={{ color: "#596579" }}>Sign in to view your inventory.</p></div> :
            filtered.length === 0 ? <div style={{ textAlign: "center", padding: "42px 12px" }}><Package size={34} color="#929bad" /><h3 style={{ marginBottom: 6 }}>No products yet</h3><p style={{ color: "#778294", fontSize: 13 }}>{canManage ? "Add your first product to start managing inventory." : "Your business inventory will appear here."}</p>{canManage && <button onClick={openNew} style={{ border: 0, background: "#635bdb", color: "white", borderRadius: 8, padding: "10px 14px" }}>Add first product</button>}</div> :
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560, textAlign: "left" }}>
                <thead><tr style={{ background: "#f8f9fc", color: "#8490a2", fontSize: 11, textTransform: "uppercase" }}><th style={{ padding: 13 }}>Product</th><th style={{ padding: 13 }}>Selling price</th><th style={{ padding: 13 }}>Stock quantity</th><th style={{ padding: 13, textAlign: "right" }}>Actions</th></tr></thead>
                <tbody>{filtered.map((product) => <tr key={product.id} style={{ borderBottom: "1px solid #e9edf3", fontSize: 13 }}>
                  <td style={{ padding: 14, fontWeight: 600 }}>{product.name}</td>
                  <td style={{ padding: 14 }}>{money(product.selling_price)}</td>
                  <td style={{ padding: 14 }}>{product.stock_quantity}</td>
                  <td style={{ padding: 14, textAlign: "right", whiteSpace: "nowrap" }}>
                    {canManage && <><button onClick={() => openEdit(product)} aria-label={`Edit ${product.name}`} style={{ border: "1px solid #e5e8ef", background: "white", borderRadius: 7, padding: 8, marginRight: 7, color: "#635bdb" }}><Pencil size={15} /></button>
                    <button onClick={() => void deleteProduct(product)} aria-label={`Delete ${product.name}`} style={{ border: "1px solid #f1dada", background: "white", borderRadius: 7, padding: 8, color: "#c34444" }}><Trash2 size={15} /></button></>}
                  </td>
                </tr>)}</tbody>
              </table>
            </div>}
          <div style={{ color: "#929bad", fontSize: 11, marginTop: 15 }}>{products.length} product{products.length === 1 ? "" : "s"} in your inventory</div>
        </section>
      </div>

      {showForm && canManage && <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,20,35,.48)", display: "grid", placeItems: "center", padding: 16, zIndex: 20 }}>
        <form onSubmit={saveProduct} onClick={(e) => e.stopPropagation()} style={{ background: "white", width: "100%", maxWidth: 440, borderRadius: 14, padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <h2 style={{ margin: 0, fontSize: 19 }}>{editing ? "Edit product" : "Add product"}</h2>
            <button type="button" onClick={() => setShowForm(false)} aria-label="Close form" style={{ border: 0, background: "transparent", color: "#778294" }}><X size={20} /></button>
          </div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Product name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wireless Router" style={{ width: "100%", padding: 12, border: "1px solid #dfe4ec", borderRadius: 8, marginBottom: 15 }} />
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Selling price (KSh)</label>
          <input required type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" style={{ width: "100%", padding: 12, border: "1px solid #dfe4ec", borderRadius: 8, marginBottom: 15 }} />
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Stock quantity</label>
          <input required type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" style={{ width: "100%", padding: 12, border: "1px solid #dfe4ec", borderRadius: 8, marginBottom: 20 }} />
          <button disabled={saving || !userId} type="submit" style={{ width: "100%", border: 0, borderRadius: 8, padding: 13, background: "#635bdb", color: "white", fontWeight: 700, opacity: saving || !userId ? .6 : 1 }}>{saving ? "Saving..." : editing ? "Save changes" : "Save product"}</button>
        </form>
      </div>}
    </main>
  );
}
