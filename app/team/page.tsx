"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users, RefreshCw, ShieldCheck, UserX, UserCheck } from "lucide-react";
import { createClient } from "../../lib/supabase/client";

type Member = { user_id: string; role: "owner" | "manager" | "cashier"; active: boolean; created_at: string };
type Sale = { user_id: string; total: number; status: string };
const money = (n: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(n || 0);

export default function TeamPage() {
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<Member[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [myId, setMyId] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteActive, setInviteActive] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setNotice("");
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user;
    if (authError || !user) { setError("Please sign in again."); setLoading(false); return; }
    setMyId(user.id);
    const inviteStatusResponse = await fetch("/api/employee-invitations", { cache: "no-store" });
    if (inviteStatusResponse.ok) {
      const inviteStatus = await inviteStatusResponse.json();
      setInviteActive(Boolean(inviteStatus.active));
    }
    const { data: businessId, error: businessError } = await supabase.rpc("current_business_owner_id");
    if (businessError || !businessId) { setError(businessError?.message || "No business is linked to this account."); setLoading(false); return; }
    setOwnerId(businessId);
    const { data: myMembership, error: roleError } = await supabase.from("business_memberships").select("role").eq("owner_id", businessId).eq("user_id", user.id).eq("active", true).maybeSingle();
    if (roleError || !myMembership || myMembership.role !== "owner") {
      setAllowed(false); setError("Only the business owner can manage employees."); setLoading(false); return;
    }
    setAllowed(true);
    const [{ data: memberRows, error: membersError }, { data: saleRows, error: salesError }] = await Promise.all([
      supabase.from("business_memberships").select("user_id, role, active, created_at").eq("owner_id", businessId).order("created_at", { ascending: true }),
      supabase.from("sales").select("user_id, total, status").order("created_at", { ascending: false }),
    ]);
    if (membersError) setError(membersError.message);
    else setMembers((memberRows || []) as Member[]);
    if (salesError) setError((old) => old || salesError.message);
    else setSales((saleRows || []) as Sale[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function manageInviteLink(action: "create" | "revoke") {
    setInviteBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/employee-invitations", { method: action === "create" ? "POST" : "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update the employee invitation link.");
      if (action === "create") {
        setInviteLink(result.link);
        setInviteActive(true);
        setNotice("Shared employee registration link created. Copy it and send it to your employees.");
      } else {
        setInviteLink(""); setInviteActive(false);
        setNotice("The shared employee registration link has been disabled.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the invitation link.");
    } finally { setInviteBusy(false); }
  }

  async function copyInviteLink() {
    if (!inviteLink) return;
    try { await navigator.clipboard.writeText(inviteLink); setNotice("Invitation link copied. You can now share it on WhatsApp."); }
    catch { setError("Copy was blocked by your browser. Select and copy the link manually."); }
  }

  async function setMemberActive(member: Member, active: boolean) {
    if (!ownerId || member.user_id === ownerId || member.role === "owner") return;
    const action = active ? "restore this employee's access" : "remove this employee's access";
    if (!window.confirm("Are you sure you want to " + action + "? Their previous sales records will be kept.")) return;
    setBusyId(member.user_id); setError(""); setNotice("");
    const { error: updateError } = await supabase.from("business_memberships").update({ active }).eq("owner_id", ownerId).eq("user_id", member.user_id);
    if (updateError) setError(updateError.message);
    else { setNotice(active ? "Employee access restored." : "Employee access removed. Historical sales were preserved."); await load(); }
    setBusyId("");
  }

  const totals = useMemo(() => {
    const result: Record<string, { count: number; revenue: number }> = {};
    for (const sale of sales) {
      if (sale.status !== "completed") continue;
      result[sale.user_id] ||= { count: 0, revenue: 0 };
      result[sale.user_id].count += 1;
      result[sale.user_id].revenue += Number(sale.total || 0);
    }
    return result;
  }, [sales]);

  return <main style={{ minHeight: "100vh", background: "#f5f7fb", color: "#182230", padding: "24px 16px", fontFamily: "Inter, Arial, sans-serif" }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#635bdb", textDecoration: "none", fontSize: 13, marginBottom: 24 }}><ArrowLeft size={17}/> Back to dashboard</Link>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <div><div style={{ color: "#635bdb", fontSize: 11, fontWeight: 700, letterSpacing: 1.3 }}>OWNER CONTROL</div><h1 style={{ fontSize: 28, margin: "8px 0" }}>Employees & access</h1><p style={{ color: "#778294", fontSize: 13, margin: 0 }}>Connected business accounts and their completed sales performance.</p></div>
        <button onClick={() => void load()} style={{ border: "1px solid #e5e8ef", background: "white", borderRadius: 8, padding: 10 }}><RefreshCw size={17}/></button>
      </header>
      {error && <div role="alert" style={{ background: "#fff0f0", color: "#a52d2d", borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 14 }}>{error}</div>}
      {notice && <div role="status" style={{ background: "#edf8f0", color: "#216b3b", borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 14 }}>{notice}</div>}
      {allowed && <section style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 13, padding: 18, marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>Shared employee registration link</h2>
        <p style={{ color: "#778294", fontSize: 13, lineHeight: 1.6 }}>Create one link and share it with all employees. Anyone with the link can request to join this business as a cashier. You can disable it or generate a replacement at any time.</p>
        {inviteActive && <p style={{ color: "#23834a", fontSize: 12 }}>A shared invitation link is currently active.</p>}
        {inviteLink && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}><input readOnly value={inviteLink} aria-label="Shared employee invitation link" style={{ flex: "1 1 230px", minWidth: 0, padding: 11, border: "1px solid #dfe4ec", borderRadius: 8, fontSize: 12 }} /><button onClick={() => void copyInviteLink()} style={{ border: 0, borderRadius: 8, background: "#635bdb", color: "white", padding: "10px 14px", fontWeight: 700 }}>Copy link</button></div>}
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}><button disabled={inviteBusy} onClick={() => void manageInviteLink("create")} style={{ border: 0, borderRadius: 8, background: "#635bdb", color: "white", padding: "11px 14px", fontWeight: 700 }}>{inviteBusy ? "Please wait..." : inviteActive ? "Generate new link" : "Create shared link"}</button>{inviteActive && <button disabled={inviteBusy} onClick={() => void manageInviteLink("revoke")} style={{ border: "1px solid #e5e8ef", borderRadius: 8, background: "white", color: "#b13b3b", padding: "10px 14px" }}>Disable link</button>}</div>
        <p style={{ color: "#8a94a5", fontSize: 11, marginTop: 12 }}>For security, generating a new link replaces the previous one. Employees receive an email to set their password. Do not post this link publicly.</p>
      </section>
      <section style={{ background: "white", border: "1px solid #e9edf3", borderRadius: 13, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}><ShieldCheck color="#635bdb"/><strong>{members.filter(m => m.active).length} active connected account(s)</strong></div>
        {loading ? <p style={{ padding: 30, textAlign: "center", color: "#778294" }}>Loading employees...</p> : members.length === 0 ? <p>No business memberships found.</p> :
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760, textAlign: "left" }}>
            <thead><tr style={{ background: "#f8f9fc", color: "#8490a2", fontSize: 11, textTransform: "uppercase" }}><th style={{ padding: 12 }}>Account ID</th><th style={{ padding: 12 }}>Role</th><th style={{ padding: 12 }}>Status</th><th style={{ padding: 12 }}>Completed sales</th><th style={{ padding: 12 }}>Revenue</th><th style={{ padding: 12, textAlign: "right" }}>Access</th></tr></thead>
            <tbody>{members.map(member => {
              const stat = totals[member.user_id] || { count: 0, revenue: 0 };
              const isBusinessOwner = member.user_id === ownerId || member.role === "owner";
              return <tr key={member.user_id} style={{ borderBottom: "1px solid #e9edf3", fontSize: 12 }}>
                <td style={{ padding: 13, fontFamily: "monospace" }}>{member.user_id}{member.user_id === myId ? " (you)" : ""}</td>
                <td style={{ padding: 13, textTransform: "capitalize" }}>{member.role}</td>
                <td style={{ padding: 13 }}><span style={{ color: member.active ? "#23834a" : "#a05252" }}>{member.active ? "Active" : "Removed"}</span></td>
                <td style={{ padding: 13 }}>{stat.count}</td><td style={{ padding: 13, fontWeight: 700 }}>{money(stat.revenue)}</td>
                <td style={{ padding: 13, textAlign: "right" }}>{isBusinessOwner ? <span style={{ color: "#778294" }}>Protected</span> : <button disabled={busyId === member.user_id} onClick={() => void setMemberActive(member, !member.active)} style={{ border: "1px solid #e5e8ef", background: "white", borderRadius: 7, padding: "8px 10px", color: member.active ? "#b13b3b" : "#23834a", display: "inline-flex", alignItems: "center", gap: 6 }}>{member.active ? <><UserX size={14}/> {busyId === member.user_id ? "Saving..." : "Remove access"}</> : <><UserCheck size={14}/> {busyId === member.user_id ? "Saving..." : "Restore access"}</>}</button>}</td>
              </tr>;
            })}</tbody>
          </table></div>}
        <p style={{ color: "#778294", fontSize: 12, lineHeight: 1.6, marginTop: 14 }}>Removing access deactivates the employee's business membership; it does not delete their login account or historical sales. Account IDs are shown because employee display names and emails are not currently stored in the membership records.</p>
      </section>}
    </div>
  </main>;
}
