"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, ShoppingCart, Package, Users, BarChart3, Bell,
  Search, Menu, X, TrendingUp, Receipt, Wallet, Clock3, RefreshCw,
  LogOut, ShieldCheck, AlertCircle
} from "lucide-react";
import { createClient } from "../lib/supabase/client";

type Sale = {
  id: string;
  receipt_number: string;
  total: number;
  status: string;
  created_at: string;
};

type Role = "owner" | "manager" | "cashier";

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(value || 0);

const shortTime = (value: string) =>
  new Intl.DateTimeFormat("en-KE", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [todaySales, setTodaySales] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);

  const loadDashboard = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setError("You are not signed in. Please sign in to your MINGLE POS account.");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setEmail(user.email || "");
    const { data: ownerId, error: ownerError } = await supabase.rpc("current_business_owner_id");
    if (ownerError || !ownerId) {
      setError(ownerError?.message || "This account is not linked to a business yet.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: membership, error: memberError } = await supabase
      .from("business_memberships")
      .select("role")
      .eq("owner_id", ownerId)
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    if (memberError || !membership) {
      setError(memberError?.message || "No active employee role was found for this account.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const currentRole = membership.role as Role;
    setRole(currentRole);
    const salesUserId = currentRole === "cashier" ? user.id : ownerId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [salesResult, productsResult, customersResult] = await Promise.all([
      supabase.from("sales")
        .select("id, receipt_number, total, status, created_at")
        .eq("user_id", salesUserId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", ownerId),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("user_id", ownerId),
    ]);

    if (salesResult.error) setError(salesResult.error.message);
    else {
      const rows = (salesResult.data || []) as Sale[];
      setSales(rows);
      const todays = rows.filter((sale) => new Date(sale.created_at) >= startOfDay);
      setTodaySales(todays.reduce((sum, sale) => sum + Number(sale.total || 0), 0));
      setTodayOrders(todays.length);
    }
    if (productsResult.error) setError((previous) => previous || productsResult.error.message);
    else setProductCount(productsResult.count || 0);
    if (customersResult.error) setError((previous) => previous || customersResult.error.message);
    else setCustomerCount(customersResult.count || 0);

    setLoading(false);
    setRefreshing(false);
  }, [supabase]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  const isCashier = role === "cashier";
  const displayName = email ? email.split("@")[0] : "Employee";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <main className="dashboard">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">M</div>
          <span>MINGLE <b>POS</b></span>
          <button className="close-menu" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></button>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          <Link href="/" className="nav-item active" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none" }}>
            <LayoutDashboard size={19} /><span>Dashboard</span>
          </Link>
          <Link href="/products" className="nav-item" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none" }}>
            <Package size={19} /><span>Products</span>
          </Link>
          <Link href="/customers" className="nav-item" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none" }}>
            <Users size={19} /><span>Customers</span>
          </Link>
          {!isCashier && <Link href="/reports" className="nav-item" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none" }}>
            <BarChart3 size={19} /><span>Reports</span>
          </Link>}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-avatar">{initials}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</strong>
            <small>{role ? role.charAt(0).toUpperCase() + role.slice(1) : "Loading role..."}</small>
          </div>
          <button onClick={signOut} title="Sign out" aria-label="Sign out" style={{ border: 0, background: "transparent", color: "#aeb5c8" }}><LogOut size={17} /></button>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button>
          <div className="search-box"><Search size={18} /><input placeholder="Search anything..." disabled /></div>
          <button className="notification" onClick={() => void loadDashboard(true)} aria-label="Refresh dashboard">
            <RefreshCw size={18} className={refreshing ? "spin" : ""} />
          </button>
          <div className="profile">{initials}</div>
        </header>

        <div className="content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">MINGLE POS WORKSPACE</p>
              <h1>{loading ? "Loading dashboard..." : `Welcome, ${displayName}`}</h1>
              <p className="muted">{isCashier ? "Your personal sales and daily activity." : "Your store activity and business overview."}</p>
            </div>
            <div className="role-chip"><ShieldCheck size={15} /> {role ? role.toUpperCase() : "ACCOUNT"}</div>
          </div>

          {error && <div role="alert" className="dashboard-alert"><AlertCircle size={17} />{error}</div>}

          <div className="stats-grid">
            <div className="stat-card">
              <span>{isCashier ? "My sales today" : "Business sales today"}</span>
              <h2>{loading ? "—" : money(todaySales)}</h2>
              <small><TrendingUp size={13} /> Based on today's recorded sales</small>
            </div>
            <div className="stat-card">
              <span>{isCashier ? "My transactions" : "Transactions today"}</span>
              <h2>{loading ? "—" : todayOrders}</h2>
              <small><Receipt size={13} /> Sales recorded today</small>
            </div>
            <div className="stat-card">
              <span>Products</span>
              <h2>{loading ? "—" : productCount}</h2>
              <small><Package size={13} /> Products in business inventory</small>
            </div>
            <div className="stat-card">
              <span>Customers</span>
              <h2>{loading ? "—" : customerCount}</h2>
              <small><Users size={13} /> Registered business customers</small>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>{isCashier ? "My recent transactions" : "Recent business transactions"}</h2>
                <p className="muted">{isCashier ? "Only sales made under your account are shown." : "Latest sales recorded in your business."}</p>
              </div>
              <button className="text-button" onClick={() => void loadDashboard(true)}><RefreshCw size={15} /> Refresh</button>
            </div>
            {loading ? <p className="empty-state">Loading your sales...</p> :
              sales.length === 0 ? <p className="empty-state">No sales recorded yet. Your completed transactions will appear here.</p> :
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Receipt</th><th>Date / Time</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>{sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.receipt_number}</td>
                      <td>{shortTime(sale.created_at)} · {new Date(sale.created_at).toLocaleDateString("en-KE")}</td>
                      <td>{money(Number(sale.total))}</td>
                      <td><span className={`status ${sale.status === "completed" ? "" : "pending"}`}>{sale.status}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>}
          </div>

          <div className="quick-actions">
            <Link href="/products"><Package size={18} /> Open inventory</Link>
            <div><ShoppingCart size={18} /> Point of Sale <span>Checkout module coming next</span></div>
            <div><Wallet size={18} /> Sales summary <span>{isCashier ? "Personal activity" : "Business activity"}</span></div>
            <div><Clock3 size={18} /> Live records <span>Synced from Supabase</span></div>
          </div>
        </div>
      </section>
    </main>
  );
}
