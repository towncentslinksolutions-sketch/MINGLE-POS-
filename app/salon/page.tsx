"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, Plus, RefreshCw, Scissors, Users, X } from "lucide-react";
import { createClient } from "../../lib/supabase/client";

type Service = { id: string; name: string; description: string; duration_minutes: number; price: number; active: boolean };
type Appointment = { id: string; customer_name: string; customer_phone: string; booking_source: "online" | "walk_in"; status: string; starts_at: string; ends_at: string; amount_charged: number; service_id: string; stylist_user_id: string; notes: string };
type Stylist = { user_id: string; role: string };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "1px solid #dce2eb", borderRadius: 9, background: "#fff", color: "#172033", fontSize: 14 };
const buttonStyle: React.CSSProperties = { border: 0, borderRadius: 9, padding: "10px 14px", background: "#6558d3", color: "#fff", fontWeight: 700, cursor: "pointer" };
const money = (n: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(Number(n || 0));
const localDateTime = (date: Date) => { const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return copy.toISOString().slice(0, 16); };

export default function SalonPage() {
  const supabase = useMemo(() => createClient(), []);
  const [ownerId, setOwnerId] = useState("");
  const [role, setRole] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showService, setShowService] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceDuration, setServiceDuration] = useState("30");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedStylist, setSelectedStylist] = useState("");
  const [startsAt, setStartsAt] = useState(localDateTime(new Date(Date.now() + 60 * 60 * 1000)));
  const [bookingSource, setBookingSource] = useState<"walk_in" | "online">("walk_in");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) { setError("Please sign in to manage Salon & Beauty."); setLoading(false); return; }
    const { data: businessId, error: ownerError } = await supabase.rpc("current_business_owner_id");
    if (ownerError || !businessId) { setError(ownerError?.message || "This account is not linked to a business."); setLoading(false); return; }
    const { data: membership, error: memberError } = await supabase.from("business_memberships").select("role").eq("owner_id", businessId).eq("user_id", session.user.id).eq("active", true).maybeSingle();
    if (memberError || !membership) { setError(memberError?.message || "Your business membership is inactive."); setLoading(false); return; }
    setOwnerId(businessId); setRole(membership.role);
    const [serviceResult, appointmentResult, staffResult] = await Promise.all([
      supabase.from("salon_services").select("id,name,description,duration_minutes,price,active").eq("owner_id", businessId).order("name"),
      supabase.from("salon_appointments").select("id,customer_name,customer_phone,booking_source,status,starts_at,ends_at,amount_charged,service_id,stylist_user_id,notes").eq("owner_id", businessId).gte("starts_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("starts_at").limit(100),
      supabase.from("business_memberships").select("user_id,role").eq("owner_id", businessId).eq("active", true)
    ]);
    if (serviceResult.error) setError(serviceResult.error.message); else setServices((serviceResult.data || []) as Service[]);
    if (appointmentResult.error) setError((old) => old || appointmentResult.error.message); else setAppointments((appointmentResult.data || []) as Appointment[]);
    if (staffResult.error) setError((old) => old || staffResult.error.message); else setStylists((staffResult.data || []) as Stylist[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function addService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!ownerId || saving) return;
    const price = Number(servicePrice); const duration = Number(serviceDuration);
    if (!serviceName.trim() || !Number.isFinite(price) || price < 0 || !Number.isInteger(duration) || duration < 5 || duration > 1440) { setError("Enter a service name, valid price and duration (5–1440 minutes)."); return; }
    setSaving(true); setError(""); setNotice("");
    const { error: insertError } = await supabase.from("salon_services").insert({ owner_id: ownerId, name: serviceName.trim(), description: serviceDescription.trim(), price, duration_minutes: duration });
    if (insertError) setError(insertError.message); else { setNotice("Service added successfully."); setServiceName(""); setServiceDescription(""); setServicePrice(""); setServiceDuration("30"); setShowService(false); await load(); }
    setSaving(false);
  }

  async function toggleService(service: Service) {
    setError(""); setNotice("");
    const { error: updateError } = await supabase.from("salon_services").update({ active: !service.active, updated_at: new Date().toISOString() }).eq("id", service.id).eq("owner_id", ownerId);
    if (updateError) setError(updateError.message); else { setNotice(service.active ? "Service deactivated." : "Service activated."); await load(); }
  }

  async function addAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!ownerId || saving) return;
    const service = services.find((item) => item.id === selectedService);
    if (!customerName.trim() || !service || !selectedStylist || !startsAt) { setError("Complete the customer, service, stylist and appointment time."); return; }
    const start = new Date(startsAt); const end = new Date(start.getTime() + service.duration_minutes * 60000);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 60000) { setError("Choose a valid future appointment time."); return; }
    setSaving(true); setError(""); setNotice("");
    const { error: insertError } = await supabase.from("salon_appointments").insert({
      owner_id: ownerId, service_id: service.id, stylist_user_id: selectedStylist,
      customer_name: customerName.trim(), customer_phone: customerPhone.trim(),
      booking_source: bookingSource, status: "confirmed", starts_at: start.toISOString(),
      ends_at: end.toISOString(), amount_charged: Number(service.price)
    });
    if (insertError) setError(insertError.message); else { setNotice("Appointment booked successfully."); setCustomerName(""); setCustomerPhone(""); setShowBooking(false); await load(); }
    setSaving(false);
  }

  async function changeStatus(appointment: Appointment, status: "confirmed" | "cancelled" | "no_show") {
    setError(""); setNotice("");
    const { error: updateError } = await supabase.from("salon_appointments").update({ status, updated_at: new Date().toISOString() }).eq("id", appointment.id).eq("owner_id", ownerId);
    if (updateError) setError(updateError.message); else { setNotice("Appointment status updated."); await load(); }
  }

  const serviceFor = (id: string) => services.find((service) => service.id === id)?.name || "Service";
  const stylistLabel = (id: string) => { const index = stylists.findIndex((stylist) => stylist.user_id === id); return index < 0 ? "Stylist" : stylists[index].role === "owner" ? "Business owner" : `Team member ${index + 1}`; };
  const todayCount = appointments.filter((item) => new Date(item.starts_at).toDateString() === new Date().toDateString() && item.status !== "cancelled").length;

  return <main style={{ minHeight: "100vh", background: "#f5f7fb", color: "#172033", padding: "22px 14px", fontFamily: "Inter,Arial,sans-serif" }}>
    <div style={{ maxWidth: 1160, margin: "0 auto" }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#6558d3", textDecoration: "none", fontSize: 13, marginBottom: 18 }}><ArrowLeft size={16}/> Back to MINGLE POS</Link>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div><div style={{ color: "#6558d3", fontSize: 11, fontWeight: 800, letterSpacing: 1.3 }}>MINGLE POS · BUSINESS MODULE</div><h1 style={{ fontSize: 29, margin: "6px 0" }}>Salon & Beauty</h1><p style={{ color: "#778294", margin: 0, fontSize: 13 }}>Manage services, stylists and customer appointments.</p></div>
        <button onClick={() => void load()} disabled={loading} style={{ ...buttonStyle, background: "#fff", color: "#536074", border: "1px solid #e1e6ee", display: "inline-flex", alignItems: "center", gap: 7 }}><RefreshCw size={15}/> Refresh</button>
      </header>
      {error && <div role="alert" style={{ background: "#fff0f0", color: "#a52d2d", padding: 12, borderRadius: 9, marginBottom: 14, fontSize: 13 }}>{error}</div>}
      {notice && <div role="status" style={{ background: "#eefaf2", color: "#176b3a", padding: 12, borderRadius: 9, marginBottom: 14, fontSize: 13 }}>{notice}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 18 }}>
        {[{ label: "Active services", value: services.filter((s) => s.active).length, icon: <Scissors size={19}/> }, { label: "Appointments loaded", value: appointments.length, icon: <CalendarDays size={19}/> }, { label: "Today's appointments", value: todayCount, icon: <Clock3 size={19}/> }, { label: "Team members", value: stylists.length, icon: <Users size={19}/> }].map((item) => <div key={item.label} style={{ background: "#fff", border: "1px solid #e8ecf2", borderRadius: 13, padding: 16 }}><div style={{ color: "#6558d3" }}>{item.icon}</div><div style={{ fontSize: 25, fontWeight: 800, marginTop: 9 }}>{item.value}</div><div style={{ color: "#778294", fontSize: 12, marginTop: 3 }}>{item.label}</div></div>)}
      </div>
      <section style={{ background: "#fff", border: "1px solid #e8ecf2", borderRadius: 13, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}><div><h2 style={{ fontSize: 18, margin: 0 }}>Salon services</h2><p style={{ color: "#778294", fontSize: 12, margin: "5px 0 0" }}>Set the services customers can book.</p></div><button onClick={() => setShowService(true)} style={{ ...buttonStyle, display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={16}/> Add service</button></div>
        {loading ? <p style={{ color: "#778294", fontSize: 13 }}>Loading salon records...</p> : services.length === 0 ? <p style={{ color: "#778294", fontSize: 13 }}>No services yet. Add your first salon service to get started.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}><thead><tr style={{ textAlign: "left", color: "#778294", fontSize: 11 }}><th style={{ padding: 10 }}>SERVICE</th><th style={{ padding: 10 }}>DURATION</th><th style={{ padding: 10 }}>PRICE</th><th style={{ padding: 10 }}>STATUS</th><th style={{ padding: 10 }}></th></tr></thead><tbody>{services.map((service) => <tr key={service.id} style={{ borderTop: "1px solid #edf0f4", fontSize: 13 }}><td style={{ padding: 11 }}><strong>{service.name}</strong>{service.description && <div style={{ color: "#778294", fontSize: 11, marginTop: 3 }}>{service.description}</div>}</td><td style={{ padding: 11 }}>{service.duration_minutes} min</td><td style={{ padding: 11, fontWeight: 700 }}>{money(Number(service.price))}</td><td style={{ padding: 11, color: service.active ? "#23834a" : "#9a6670" }}>{service.active ? "Active" : "Inactive"}</td><td style={{ padding: 11, textAlign: "right" }}><button onClick={() => void toggleService(service)} style={{ border: "1px solid #e1e6ee", borderRadius: 7, padding: "7px 9px", background: "#fff", color: "#536074", fontSize: 11 }}>{service.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div>}
      </section>
      <section style={{ background: "#fff", border: "1px solid #e8ecf2", borderRadius: 13, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}><div><h2 style={{ fontSize: 18, margin: 0 }}>Appointments</h2><p style={{ color: "#778294", fontSize: 12, margin: "5px 0 0" }}>Recent and upcoming appointments, including walk-ins.</p></div><button onClick={() => setShowBooking(true)} disabled={!services.some((s) => s.active) || stylists.length === 0} style={{ ...buttonStyle, display: "inline-flex", alignItems: "center", gap: 6, opacity: !services.some((s) => s.active) || stylists.length === 0 ? .5 : 1 }}><Plus size={16}/> New appointment</button></div>
        {appointments.length === 0 ? <p style={{ color: "#778294", fontSize: 13 }}>No appointments found for the last seven days and upcoming schedule.</p> : <div style={{ display: "grid", gap: 10 }}>{appointments.map((appointment) => <article key={appointment.id} style={{ border: "1px solid #edf0f4", borderRadius: 10, padding: 13, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}><div style={{ minWidth: 190 }}><strong style={{ fontSize: 14 }}>{appointment.customer_name}</strong><div style={{ color: "#778294", fontSize: 12, marginTop: 4 }}>{serviceFor(appointment.service_id)} · {stylistLabel(appointment.stylist_user_id)}</div><div style={{ color: "#778294", fontSize: 11, marginTop: 4 }}>{new Date(appointment.starts_at).toLocaleString("en-KE")} · {appointment.booking_source === "walk_in" ? "Walk-in" : "Online booking"}</div></div><div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: 13 }}>{money(Number(appointment.amount_charged))}</strong><span style={{ fontSize: 11, padding: "5px 8px", borderRadius: 20, background: appointment.status === "confirmed" ? "#eef4ff" : appointment.status === "cancelled" ? "#fff0f0" : "#f2f4f7", color: appointment.status === "confirmed" ? "#3559a5" : appointment.status === "cancelled" ? "#a52d2d" : "#536074" }}>{appointment.status.replace("_", " ")}</span>{appointment.status !== "cancelled" && <select aria-label="Appointment status" value={appointment.status} onChange={(e) => { const value = e.target.value; if (value === "confirmed" || value === "cancelled" || value === "no_show") void changeStatus(appointment, value); }} style={{ ...inputStyle, width: 118, padding: "7px 8px", fontSize: 11 }}><option value={appointment.status}>{appointment.status}</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option><option value="no_show">No show</option></select>}</div></article>)}</div>}
      </section>
      {showService && <div role="dialog" aria-modal="true" aria-label="Add salon service" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "grid", placeItems: "center", padding: 14, zIndex: 60 }}><form onSubmit={addService} style={{ background: "#fff", borderRadius: 14, padding: 19, width: "100%", maxWidth: 440, display: "grid", gap: 11 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ margin: 0, fontSize: 18 }}>Add salon service</h2><button type="button" onClick={() => setShowService(false)} aria-label="Close" style={{ border: 0, background: "transparent" }}><X/></button></div><label style={{ fontSize: 12 }}>Service name<input required maxLength={120} value={serviceName} onChange={(e) => setServiceName(e.target.value)} style={inputStyle}/></label><label style={{ fontSize: 12 }}>Description<textarea value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} maxLength={500} rows={2} style={inputStyle}/></label><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><label style={{ fontSize: 12 }}>Price (KES)<input required type="number" min="0" step="0.01" value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} style={inputStyle}/></label><label style={{ fontSize: 12 }}>Duration (minutes)<input required type="number" min="5" max="1440" step="5" value={serviceDuration} onChange={(e) => setServiceDuration(e.target.value)} style={inputStyle}/></label></div><button disabled={saving} style={buttonStyle}>{saving ? "Saving..." : "Save service"}</button></form></div>}
      {showBooking && <div role="dialog" aria-modal="true" aria-label="New appointment" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "grid", placeItems: "center", padding: 14, zIndex: 60 }}><form onSubmit={addAppointment} style={{ background: "#fff", borderRadius: 14, padding: 19, width: "100%", maxWidth: 440, display: "grid", gap: 11, maxHeight: "92vh", overflowY: "auto" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ margin: 0, fontSize: 18 }}>New appointment</h2><button type="button" onClick={() => setShowBooking(false)} aria-label="Close" style={{ border: 0, background: "transparent" }}><X/></button></div><label style={{ fontSize: 12 }}>Customer name<input required value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={inputStyle}/></label><label style={{ fontSize: 12 }}>Phone number<input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={inputStyle}/></label><label style={{ fontSize: 12 }}>Service<select required value={selectedService} onChange={(e) => setSelectedService(e.target.value)} style={inputStyle}><option value="">Choose service</option>{services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} · {money(Number(s.price))} · {s.duration_minutes} min</option>)}</select></label><label style={{ fontSize: 12 }}>Stylist<select required value={selectedStylist} onChange={(e) => setSelectedStylist(e.target.value)} style={inputStyle}><option value="">Choose stylist</option>{stylists.map((s) => <option key={s.user_id} value={s.user_id}>{s.role === "owner" ? "Business owner" : `Team member ${stylists.indexOf(s) + 1}`}</option>)}</select></label><label style={{ fontSize: 12 }}>Appointment date & time<input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={inputStyle}/></label><label style={{ fontSize: 12 }}>Booking type<select value={bookingSource} onChange={(e) => setBookingSource(e.target.value as "walk_in" | "online")} style={inputStyle}><option value="walk_in">Walk-in</option><option value="online">Online booking (staff-entered)</option></select></label><button disabled={saving} style={buttonStyle}>{saving ? "Booking..." : "Create appointment"}</button></form></div>}
      <p style={{ color: "#8993a4", fontSize: 11, textAlign: "center", marginTop: 18 }}>Signed in as {role || "team member"} · Salon records are kept separate from retail stock.</p>
    </div>
  </main>;
}
