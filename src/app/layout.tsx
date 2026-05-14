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
        <header className="sticky top-0 z-30 backdrop-blur-lg bg-[color:var(--bg)]/80 border-b border-[color:var(--border)]">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span className="dot group-hover:scale-125 transition-transform duration-200" />
              <span className="mono text-[15px] tracking-tight font-semibold">
                skill<span className="text-[color:var(--accent)]">make</span>
              </span>
              <span className="hidden sm:inline mono text-[11px] text-[color:var(--fg-dim)] ml-1 opacity-60 group-hover:opacity-100 transition-opacity">
                v0.1
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className="nav-link px-3 py-1.5 rounded-md text-sm text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
              >
                Browse
              </Link>
              <Link
                href="/submit"
                className="nav-link px-3 py-1.5 rounded-md text-sm text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
              >
                Submit
              </Link>
              <Link
                href="/security"
                className="nav-link px-3 py-1.5 rounded-md text-sm text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
              >
                Security
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[color:var(--border)] mt-24">
          <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-[color:var(--fg-dim)]">
            <div className="flex items-center gap-2.5">
              <span className="dot" />
              <span className="mono">skillmake.xyz</span>
              <span className="hidden sm:inline text-[color:var(--border-strong)]">·</span>
              <span className="hidden sm:inline">personally vetted skills for creators</span>
            </div>
            <div className="flex items-center gap-5 mono text-xs">
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="opacity-60"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.5 7.5h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3a.5.5 0 0 1 1 0v3h3a.5.5 0 0 1 0 1z"/></svg>
                prompt-injection-hardened
              </span>
              <a
                href="https://hydradb.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[color:var(--accent)] transition"
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
