"use client";

import { useEffect } from "react";

type DwellBucket = "0-5s" | "5-15s" | "15-30s" | "30-60s" | "60-300s" | "300s+";
type ScrollBucket = "0" | "25" | "50" | "75" | "100";

export function Telemetry() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const start = performance.now();
    let visibleSince = start;
    let visibleMs = 0;
    let maxScrollPct = 0;
    let sent = false;

    const measureScroll = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const pct = Math.min(100, Math.max(0, (window.scrollY / max) * 100));
      if (pct > maxScrollPct) maxScrollPct = pct;
    };
    measureScroll();

    const onScroll = () => {
      // requestIdleCallback isn't universal; rAF keeps it cheap.
      requestAnimationFrame(measureScroll);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        visibleMs += performance.now() - visibleSince;
      } else {
        visibleSince = performance.now();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const send = () => {
      if (sent) return;
      sent = true;
      if (document.visibilityState === "visible") {
        visibleMs += performance.now() - visibleSince;
      }
      const seconds = visibleMs / 1000;
      const dwell = dwellBucket(seconds);
      const scroll = scrollBucket(maxScrollPct);
      beacon({ event: "page_dwell", slug: dwell });
      beacon({ event: "scroll_depth", slug: scroll });
    };

    const onPagehide = () => send();
    const onHide = () => {
      if (document.visibilityState === "hidden") send();
    };

    window.addEventListener("pagehide", onPagehide);
    document.addEventListener("visibilitychange", onHide);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPagehide);
      document.removeEventListener("visibilitychange", onHide);
      send();
    };
  }, []);

  return null;
}

function beacon(payload: { event: string; slug: string }) {
  try {
    const data = JSON.stringify(payload);
    const url = "/api/track";
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([data], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: data,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never break a page on telemetry failure
  }
}

function dwellBucket(seconds: number): DwellBucket {
  if (seconds < 5) return "0-5s";
  if (seconds < 15) return "5-15s";
  if (seconds < 30) return "15-30s";
  if (seconds < 60) return "30-60s";
  if (seconds < 300) return "60-300s";
  return "300s+";
}

function scrollBucket(pct: number): ScrollBucket {
  if (pct >= 100) return "100";
  if (pct >= 75) return "75";
  if (pct >= 50) return "50";
  if (pct >= 25) return "25";
  return "0";
}

export function trackGithubClick(slug: string) {
  if (!slug) return;
  beacon({ event: "github_click", slug: slug.toLowerCase().slice(0, 64) });
}
