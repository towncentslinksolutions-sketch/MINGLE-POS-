
"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  Bell,
  Search,
  Plus,
  ArrowUpRight,
  Menu,
  X,
} from "lucide-react";

const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Point of Sale", icon: ShoppingCart },
  { name: "Products", icon: Package },
  { name: "Customers", icon: Users },
  { name: "Reports", icon: BarChart3 },
  { name: "Settings", icon: Settings },
];

const transactions = [
  { id: "#MNG-001", customer: "Walk-in Customer", amount: "KSh 2,500", status: "Completed" },
  { id: "#MNG-002", customer: "John Kamau", amount: "KSh 1,800", status: "Completed" },
  { id: "#MNG-003", customer: "Mary Wanjiku", amount: "KSh 4,200", status: "Pending" },
];

export default function Home() {
  const [active, setActive] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="dashboard">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">M</div>
          <span>MINGLE <b>POS</b></span>
          <button className="close-menu" onClick={() => setMenuOpen(false)}><X /></button>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <nav>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                className={`nav-item ${active === item.name ? "active" : ""}`}
                onClick={() => {
                  setActive(item.name);
                  setMenuOpen(false);
                }}
              >
                <Icon size={19} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-avatar">MN</div>
          <div><strong>Store Admin</strong><small>Administrator</small></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)}><Menu /></button>
          <div className="search-box">
            <Search size={18} />
            <input placeholder="Search anything..." />
          </div>
          <button className="notification"><Bell size={20} /></button>
          <div className="profile">MN</div>
        </header>

        <div className="content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">YOUR BUSINESS AT A GLANCE</p>
              <h1>{active}</h1>
              <p className="muted">Welcome to your MINGLE POS workspace.</p>
            </div>
            <button className="primary-button" onClick={() => setActive("Point of Sale")}>
              <Plus size={18} /> New Sale
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span>Total Sales</span>
              <h2>KSh 0.00</h2>
              <small>Today's sales</small>
            </div>
            <div className="stat-card">
              <span>Orders</span>
              <h2>0</h2>
              <small>Today's transactions</small>
            </div>
            <div className="stat-card">
              <span>Products</span>
              <h2>0</h2>
              <small>Items in inventory</small>
            </div>
            <div className="stat-card">
              <span>Customers</span>
              <h2>0</h2>
              <small>Registered customers</small>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Recent Transactions</h2>
                <p className="muted">Your latest sales activity</p>
              </div>
              <button className="text-button" onClick={() => setActive("Reports")}>
                View reports <ArrowUpRight size={16} />
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Transaction</th><th>Customer</th><th>Amount</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {transactions.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.customer}</td>
                      <td>{item.amount}</td>
                      <td><span className={`status ${item.status === "Pending" ? "pending" : ""}`}>{item.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="sample-note">Illustrative sample transactions only. Live sales will appear after setup.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
