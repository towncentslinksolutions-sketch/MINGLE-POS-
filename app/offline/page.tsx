export default function OfflinePage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#0b1020", color: "white", textAlign: "center" }}>
      <section style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
        <h1 style={{ fontSize: 28, marginBottom: 12 }}>You are offline</h1>
        <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>MINGLE POS needs an internet connection to load live business records. Reconnect and try again.</p>
      </section>
    </main>
  );
}
