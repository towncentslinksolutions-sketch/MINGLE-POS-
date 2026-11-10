"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        void navigator.serviceWorker.register("/sw.js").catch((error) => {
          console.error("MINGLE POS service worker registration failed:", error);
        });
      }, { once: true });
    }
  }, []);
  return null;
}
