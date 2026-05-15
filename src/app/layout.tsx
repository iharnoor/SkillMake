import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SkillMake — a curated marketplace of agent-installable skills, for creators",
  description:
    "Personally vetted SKILL.md files for Claude Code, Codex, and other agents — built from real docs, optionally backed by tutorial videos, with semantic search.",
  metadataBase: new URL("https://skillmake.xyz"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-[color:var(--accent)] focus:text-[#0b0d10] focus:font-semibold focus:text-sm"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-30 backdrop-blur-md bg-[color:var(--bg)]/70 border-b border-[color:var(--border)]">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              <span className="dot" />
              <span className="mono text-[15px] tracking-tight font-semibold">
                skill<span className="text-[color:var(--accent)]">make</span>
              </span>
              <span className="hidden sm:inline mono text-[11px] text-[color:var(--fg-dim)] ml-1">
                v0.1
              </span>
            </Link>
            <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto">
              <Link
                href="/"
                className="px-2.5 sm:px-3 py-1.5 rounded-md text-sm text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition whitespace-nowrap"
              >
                Browse
              </Link>
              <Link
                href="/tricks"
                className="px-2.5 sm:px-3 py-1.5 rounded-md text-sm text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition whitespace-nowrap"
              >
                Tricks
              </Link>
              <Link
                href="/powerhouse"
                className="px-2.5 sm:px-3 py-1.5 rounded-md text-sm text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition whitespace-nowrap"
              >
                Powerhouse
              </Link>
              <Link
                href="/submit"
                className="px-2.5 sm:px-3 py-1.5 rounded-md text-sm text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition whitespace-nowrap"
              >
                Submit
              </Link>
              <Link
                href="/security"
                className="px-2.5 sm:px-3 py-1.5 rounded-md text-sm text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition whitespace-nowrap"
              >
                Security
              </Link>
            </nav>
          </div>
        </header>
        <main id="main" className="flex-1">{children}</main>
        <footer className="border-t border-[color:var(--border)] mt-24">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-[color:var(--fg-dim)]">
            <span className="mono">skillmake.xyz · personally vetted skills for agents</span>
            <div className="flex items-center gap-4 mono text-xs">
              <span>prompt-injection-hardened by default</span>
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
      </body>
    </html>
  );
}
