import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const googleAnalyticsId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  title: "SkillMake — a curated marketplace of agent-installable skills, for creators",
  description:
    "Personally vetted SKILL.md files for Claude Code, Codex, and other agents — built from real docs, optionally backed by tutorial videos, with semantic search.",
  metadataBase: new URL(SITE_URL),
  verification: googleSiteVerification
    ? {
        google: googleSiteVerification,
      }
    : undefined,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-30 backdrop-blur-md bg-[color:var(--bg)]/70 border-b border-[color:var(--border)]">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" prefetch={false} className="flex items-center gap-2.5 group">
              <span className="dot" />
              <span className="mono text-[15px] tracking-tight font-semibold">
                skill<span className="text-[color:var(--accent)]">make</span>
              </span>
              <span className="hidden sm:inline mono text-[11px] text-[color:var(--fg-dim)] ml-1">
                v0.1
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                prefetch={false}
                className="px-3 py-3 sm:py-1.5 rounded-md text-sm text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition inline-flex items-center min-h-[44px] sm:min-h-0"
              >
                Browse
              </Link>
              <Link
                href="/packs"
                prefetch={false}
                className="px-3 py-3 sm:py-1.5 rounded-md text-sm text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition inline-flex items-center min-h-[44px] sm:min-h-0"
              >
                Packs
              </Link>
              <Link
                href="/universe"
                prefetch={false}
                className="px-3 py-3 sm:py-1.5 rounded-md text-sm text-[color:var(--accent)] hover:brightness-125 transition inline-flex items-center min-h-[44px] sm:min-h-0"
              >
                Universe
              </Link>
              <Link
                href="/submit"
                prefetch={false}
                className="px-3 py-3 sm:py-1.5 rounded-md text-sm text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition inline-flex items-center min-h-[44px] sm:min-h-0"
              >
                Submit
              </Link>
              <Link
                href="/security"
                prefetch={false}
                className="px-3 py-3 sm:py-1.5 rounded-md text-sm text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition inline-flex items-center min-h-[44px] sm:min-h-0"
              >
                Security
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[color:var(--border)] mt-24">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-[color:var(--fg-dim)]">
            <span className="mono">skillmake.xyz · personally vetted skills for creators</span>
            <div className="flex items-center gap-4 mono text-xs flex-wrap">
              <span>prompt-injection-hardened by default</span>
              <a
                href="/skillopt-guide-2026-05-27"
                title="SkillOpt: treat each SKILL.md as a trainable parameter. Bounded edits, static gate, version history."
                className="hover:text-[color:var(--fg)] transition"
              >
                skills self-optimize with SkillOpt ↗
              </a>
              <a
                href="https://hydradb.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[color:var(--fg)] transition"
              >
                semantic search by hydradb ↗
              </a>
            </div>
          </div>
        </footer>
        <TelemetryScript />
        {googleAnalyticsId ? <GoogleAnalyticsScript gaId={googleAnalyticsId} /> : null}
      </body>
    </html>
  );
}

function TelemetryScript() {
  return (
    <script
      type="module"
      dangerouslySetInnerHTML={{
        __html: String.raw`
(() => {
  const beacon = (payload) => {
    try {
      const data = JSON.stringify(payload);
      googleAnalyticsEvent(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([data], { type: "application/json" }));
        return;
      }
      fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: data,
        keepalive: true
      }).catch(() => {});
    } catch {}
  };
  const googleAnalyticsEvent = (payload) => {
    try {
      if (!payload?.event) return;
      window.skillmakeGaQueue = window.skillmakeGaQueue || [];
      if (typeof window.skillmakeGaEvent === "function") {
        window.skillmakeGaEvent(payload);
        return;
      }
      window.skillmakeGaQueue.push(payload);
    } catch {}
  };
  const dwellBucket = (seconds) => seconds < 5 ? "0-5s" : seconds < 15 ? "5-15s" : seconds < 30 ? "15-30s" : seconds < 60 ? "30-60s" : seconds < 300 ? "60-300s" : "300s+";
  const scrollBucket = (pct) => pct >= 100 ? "100" : pct >= 75 ? "75" : pct >= 50 ? "50" : pct >= 25 ? "25" : "0";

  const start = performance.now();
  let visibleSince = start;
  let visibleMs = 0;
  let maxScrollPct = 0;
  let sent = false;
  let scrollFrame = 0;

  const measureScroll = () => {
    scrollFrame = 0;
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - innerHeight);
    maxScrollPct = Math.max(maxScrollPct, Math.min(100, Math.max(0, (scrollY / max) * 100)));
  };
  const send = () => {
    if (sent) return;
    sent = true;
    measureScroll();
    if (document.visibilityState === "visible") visibleMs += performance.now() - visibleSince;
    beacon({ event: "page_dwell", slug: dwellBucket(visibleMs / 1000) });
    beacon({ event: "scroll_depth", slug: scrollBucket(maxScrollPct) });
  };

  addEventListener("scroll", () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(measureScroll);
  }, { passive: true });
  addEventListener("pagehide", send);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      visibleMs += performance.now() - visibleSince;
      send();
    } else {
      visibleSince = performance.now();
    }
  });
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element
      ? event.target.closest("a[data-github-slug]")
      : null;
    if (link?.dataset.githubSlug) {
      beacon({ event: "github_click", slug: link.dataset.githubSlug });
    }
  });
})();
`,
      }}
    />
  );
}

function GoogleAnalyticsScript({ gaId }: { gaId: string }) {
  return (
    <script
      type="module"
      dangerouslySetInnerHTML={{
        __html: `
(() => {
  const gaId = ${JSON.stringify(gaId)};
  const start = () => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(){ dataLayer.push(arguments); };
    window.skillmakeGaEvent = (payload) => {
      if (!payload?.event) return;
      const params = {};
      if (payload.slug) params.skill_slug = payload.slug;
      gtag("event", payload.event, params);
    };
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gaId);
    script.onload = () => {
      gtag("js", new Date());
      gtag("config", gaId);
      for (const payload of window.skillmakeGaQueue || []) {
        window.skillmakeGaEvent(payload);
      }
      window.skillmakeGaQueue = [];
    };
    document.head.appendChild(script);
  };
  if ("requestIdleCallback" in window) {
    requestIdleCallback(start, { timeout: 3000 });
  } else {
    addEventListener("load", () => setTimeout(start, 1500), { once: true });
  }
})();
`,
      }}
    />
  );
}
