"use client";
import { useEffect } from "react";

async function lireLienEnAttente() {
  try {
    const cache = await caches.open("push-nav");
    const rep = await cache.match("/pending-nav");
    if (!rep) return;
    const link = await rep.text();
    await cache.delete("/pending-nav");
    const url = new URL(link);
    if (url.origin === window.location.origin && url.pathname + url.search !== window.location.pathname + window.location.search) {
      window.location.href = link;
    }
  } catch {}
}

export function PushNavigation() {
  useEffect(() => {
    lireLienEnAttente(); // ouverture à froid
    const onVisible = () => document.visibilityState === "visible" && lireLienEnAttente();
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "NAVIGATE") lireLienEnAttente();
    };
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, []);
  return null;
}