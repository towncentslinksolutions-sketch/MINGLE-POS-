import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "./pwa-register";

export const metadata: Metadata = {
  title: "MINGLE POS",
  description: "Smart cloud-based Point of Sale System",
  manifest: "/manifest.webmanifest",
  applicationName: "MINGLE POS",
  appleWebApp: {
    capable: true,
    title: "MINGLE POS",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#111827",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
        <footer style={{ padding: "16px 12px", textAlign: "center", color: "#64748b", fontSize: 12, borderTop: "1px solid rgba(148,163,184,0.18)" }}>
          © 2026 Sir Nick Technologies. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
