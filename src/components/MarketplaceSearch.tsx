"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Result {
  id: string;
  name: string;
  description: string;
  category: string;
  score: number;
  mode: "semantic" | "fallback";
}

interface Response {
  mode: "semantic" | "fallback";
  results: Result[];
}

export function MarketplaceSearch() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setData(null);
      return;
    }
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: q }),
          signal: ctrl.signal,
        });
        const d = (await res.json()) as Response;
        setData(d);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setData({ mode: "fallback", results: [] });
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div>
      <div className="input-shell rounded-xl flex items-center gap-2 p-1 mb-4">
        <span className="mono text-[color:var(--fg-dim)] text-xs pl-3">⌕</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Try: "stream video frames", "rate-limited fetch", "react server components"'
          className="flex-1 bg-transparent outline-none text-[14px] mono py-2.5 pr-2 placeholder:text-[color:var(--fg-dim)]"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="text-xs text-[color:var(--fg-dim)] hover:text-[color:var(--fg)] px-3"
          >
            clear
          </button>
        )}
      </div>

      {q && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 text-[11px] mono text-[color:var(--fg-dim)]">
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="dot pulse-dot" /> searching…
              </span>
            ) : data ? (
              <>
                <span
                  className={
                    data.mode === "semantic" ? "tag tag-accent" : "tag"
                  }
                  title={
                    data.mode === "semantic"
                      ? "Vector search via HydraDB"
                      : "HydraDB not configured — falling back to substring match"
                  }
                >
                  {data.mode === "semantic" ? "HydraDB · semantic" : "fallback · substring"}
                </span>
                <span>{data.results.length} result{data.results.length === 1 ? "" : "s"}</span>
              </>
            ) : null}
          </div>

          {data && data.results.length === 0 && !loading && (
            <div className="card p-6 text-center text-sm text-[color:var(--fg-muted)]">
              No matches. Try different words — semantic search understands synonyms.
            </div>
          )}

          <div className="space-y-2">
            {data?.results.map((r) => (
              <Link
                key={r.id}
                href={`/marketplace/${r.id}`}
                className="card p-4 flex items-start gap-4 hover:border-[color:var(--accent)] transition group"
              >
                <div
                  className="mono text-[10px] tracking-wider px-2 py-1 rounded-md self-start mt-0.5"
                  style={{
                    background: scoreToBg(r.score),
                    color: r.score >= 0.7 ? "#0b0d10" : "var(--fg)",
                  }}
                >
                  {r.score.toFixed(2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="mono text-[14px] font-semibold">{r.name}</span>
                    <span className="tag">{r.category}</span>
                  </div>
                  <div className="text-[13px] text-[color:var(--fg-muted)] line-clamp-2 mt-1">
                    {r.description}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function scoreToBg(s: number): string {
  if (s >= 0.85) return "var(--accent)";
  if (s >= 0.65) return "color-mix(in oklab, var(--accent) 60%, var(--surface))";
  if (s >= 0.45) return "color-mix(in oklab, var(--accent) 25%, var(--surface))";
  return "var(--bg-elevated)";
}
