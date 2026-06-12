"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 30_000;

/**
 * Live wallboard refresh. Re-runs the (force-dynamic) analytics server component
 * on an interval via router.refresh(), so the page re-queries Cloudflare Analytics
 * Engine without a full reload. Pauses while the tab is hidden to avoid burning
 * API calls on an unwatched board. Replaces the live view we used to get from Grafana.
 */
export function LiveRefresh() {
  const router = useRouter();
  const [live, setLive] = useState(true);
  const [pending, setPending] = useState(false);
  const liveRef = useRef(live);
  liveRef.current = live;

  useEffect(() => {
    if (!live) return;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      setPending(true);
      router.refresh();
      // router.refresh() resolves once the server component re-renders; clear the
      // pulse shortly after so the indicator reflects activity, not exact timing.
      window.setTimeout(() => setPending(false), 1200);
    };

    const id = window.setInterval(tick, INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && liveRef.current) tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live, router]);

  return (
    <button
      onClick={() => setLive((v) => !v)}
      className="btn-ghost rounded-md px-3 py-1.5 text-xs inline-flex items-center gap-2"
      title={live ? `Live — refreshing every ${INTERVAL_MS / 1000}s` : "Paused"}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          live
            ? pending
              ? "bg-[#7ee787] animate-ping"
              : "bg-[#7ee787]"
            : "bg-[color:var(--fg-dim)]"
        }`}
      />
      {live ? "Live" : "Paused"}
    </button>
  );
}
