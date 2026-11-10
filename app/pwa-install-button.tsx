"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
    };
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone) {
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setShowHelp((value) => !value);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  }

  if (installed) return null;

  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => void install()} aria-label="Install MINGLE POS" style={{ border: "1px solid #dbe2ea", borderRadius: 10, padding: "9px 12px", background: "#fff", color: "#172033", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
        ⬇ Install app
      </button>
      {showHelp && (
        <div role="status" style={{ position: "absolute", zIndex: 30, right: 0, top: "calc(100% + 8px)", width: 260, padding: 14, border: "1px solid #dbe2ea", borderRadius: 12, background: "#fff", color: "#172033", boxShadow: "0 8px 30px rgba(0,0,0,.14)", fontSize: 13, lineHeight: 1.5 }}>
          In Chrome, tap the ⋮ menu, then choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
        </div>
      )}
    </div>
  );
}
