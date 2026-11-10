"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, ShoppingCart, Package, Users, BarChart3, Bell,
  Search, Menu, X, TrendingUp, Receipt, Wallet, Clock3, RefreshCw,
  LogOut, ShieldCheck, AlertCircle, UserCog
} from "lucide-react";
import { createClient } from "../lib/supabase/client";
import PwaInstallButton from "./pwa-install-button";

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
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; detail: string; type: string; href: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const loadDashboard = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (authError || !user) {
      setError(authError?.message || "Your MINGLE POS session is not available. Please sign in again.");
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
    let salesUserIds = [user.id];
    if (currentRole !== "cashier") {
      const { data: memberships, error: membershipsError } = await supabase.from("business_memberships").select("user_id").eq("owner_id", ownerId).eq("active", true);
      if (membershipsError) {
        setError(membershipsError.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      salesUserIds = [...new Set([ownerId, ...(memberships || []).map((m) => m.user_id)])];
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [salesResult, dailyResult, productsResult, customersResult] = await Promise.all([
      supabase.from("sales")
        .select("id, receipt_number, total, status, created_at")
        .in("user_id", salesUserIds)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase.from("sales").select("total, created_at")
        .in("user_id", salesUserIds)
        .gte("created_at", startOfDay.toISOString()),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", ownerId),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("user_id", ownerId),
    ]);

    if (salesResult.error) setError(salesResult.error.message);
    else {
      const rows = (salesResult.data || []) as Sale[];
      setSales(rows);
      const todays = dailyResult.data || [];
      setTodaySales(todays.reduce((sum, sale) => sum + Number(sale.total || 0), 0));
      setTodayOrders(todays.length);
    }
    if (dailyResult.error) setError((previous) => previous || dailyResult.error.message);
    if (productsResult.error) setError((previous) => previous || productsResult.error.message);
    else setProductCount(productsResult.count || 0);
    if (customersResult.error) setError((previous) => previous || customersResult.error.message);
    else setCustomerCount(customersResult.count || 0);

    setLoading(false);
    setRefreshing(false);
  }, [supabase]);


  useEffect(() => {
    const term = globalSearch.trim();
    if (term.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        if (active) { setSearchResults([]); setSearching(false); }
        return;
      }
      const { data: ownerId } = await supabase.rpc("current_business_owner_id");
      if (!ownerId) {
        if (active) { setSearchResults([]); setSearching(false); }
        return;
      }
      const { data: membership } = await supabase.from("business_memberships")
        .select("role").eq("owner_id", ownerId).eq("user_id", user.id)
        .eq("active", true).maybeSingle();
      if (!membership) {
        if (active) { setSearchResults([]); setSearching(false); }
        return;
      }
      const salesIds = [user.id];
      if (membership.role !== "cashier") {
        const { data: members } = await supabase.from("business_memberships")
          .select("user_id").eq("owner_id", ownerId).eq("active", true);
        salesIds.push(ownerId, ...(members || []).map((m) => m.user_id));
      }
      const pattern = `%${term.replace(/[%_,]/g, " ")}%`;
      const [productsResult, namesResult, phonesResult, emailsResult, salesResult] = await Promise.all([
        supabase.from("products").select("id, name, selling_price, stock_quantity")
          .eq("user_id", ownerId).ilike("name", pattern).limit(5),
        supabase.from("customers").select("id, full_name, phone, email")
          .eq("user_id", ownerId).ilike("full_name", pattern).limit(5),
        supabase.from("customers").select("id, full_name, phone, email")
          .eq("user_id", ownerId).ilike("phone", pattern).limit(5),
        supabase.from("customers").select("id, full_name, phone, email")
          .eq("user_id", ownerId).ilike("email", pattern).limit(5),
        supabase.from("sales").select("id, receipt_number, total, status")
          .in("user_id", [...new Set(salesIds)]).ilike("receipt_number", pattern)
          .order("created_at", { ascending: false }).limit(5)
      ]);
      if (!active) return;
      const customers = [...(namesResult.data || []), ...(phonesResult.data || []), ...(emailsResult.data || [])]
        .filter((row, index, all) => all.findIndex((item) => item.id === row.id) === index).slice(0, 5);
      const results = [
        ...(productsResult.data || []).map((item) => ({
          id: item.id, title: item.name, detail: `Product · ${money(Number(item.selling_price))} · Stock ${item.stock_quantity}`,
          type: "Product", href: "/products"
        })),
        ...customers.map((item) => ({
          id: item.id, title: item.full_name, detail: `Customer · ${item.phone || item.email || "Customer record"}`,
          type: "Customer", href: "/customers"
        })),
        ...(salesResult.data || []).map((item) => ({
          id: item.id, title: item.receipt_number, detail: `Sale · ${money(Number(item.total))} · ${item.status}`,
          type: "Sale", href: membership.role === "cashier" ? "/" : "/reports"
        }))
      ];
      setSearchResults(results);
      setSearching(false);
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [globalSearch, supabase]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
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
          {role === "owner" && <Link href="/payment-settings" className="nav-item" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none" }}><Wallet size={19} /><span>Payment settings</span></Link>}
          {role === "owner" && <Link href="/team" className="nav-item" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none" }}>
            <UserCog size={19} /><span>Employees</span>
          </Link> }
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
          <div className="search-box" style={{ position: "relative" }}>
            <Search size={18} />
            <input value={globalSearch} onChange={(event) => { setGlobalSearch(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); }} placeholder="Search products, customers, sales..." aria-label="Search products, customers and sales" />
            {searchOpen && globalSearch.trim().length >= 2 && <div style={{ position: "absolute", top: "calc(100% + 10px)", left: 0, right: 0, zIndex: 50, background: "white", border: "1px solid #e5e8ef", borderRadius: 10, boxShadow: "0 12px 35px rgba(20,30,50,.16)", padding: 8, maxHeight: 360, overflowY: "auto", minWidth: 260 }}>
              {searching ? <p style={{ margin: 0, padding: 12, color: "#778294", fontSize: 12 }}>Searching...</p> :
                searchResults.length ? searchResults.map((result) => <Link key={result.type + result.id} href={result.href} onClick={() => { setSearchOpen(false); setGlobalSearch(""); }} style={{ display: "block", padding: "10px 11px", borderRadius: 7, textDecoration: "none", color: "#182230" }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 650 }}>{result.title}</span>
                  <span style={{ display: "block", fontSize: 11, color: "#778294", marginTop: 3 }}>{result.detail}</span>
                </Link>) : <p style={{ margin: 0, padding: 12, color: "#778294", fontSize: 12 }}>No matching products, customers or sales.</p>}
            </div>}
          </div>
          <PwaInstallButton />
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
            {role === "owner" && <Link href="/team"><Users size={18} /> Invite employees</Link>}
            <div><ShoppingCart size={18} /> Point of Sale <span>Checkout module coming next</span></div>
            <div><Wallet size={18} /> Sales summary <span>{isCashier ? "Personal activity" : "Business activity"}</span></div>
            <div><Clock3 size={18} /> Live records <span>Synced from Supabase</span></div>
          </div>
        </div>
      </section>
    </main>
  );
}
