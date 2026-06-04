import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import { track } from "@/lib/metrics";
import { findApprovedByName, type MarketplaceEntry } from "@/lib/storage";
import { type CollectionEntry, McpsSections } from "./McpsSections";

export const dynamic = "force-dynamic";

const FAMOUS_MCP_ENTRIES: CollectionEntry[] = [
  famousRow(
    "context7-mcp",
    "Up-to-date package docs and code examples for AI coding agents.",
    "https://github.com/upstash/context7",
    56309
  ),
  famousRow(
    "github-mcp-server",
    "GitHub's official MCP server for repository, issue, pull request, and workflow context.",
    "https://github.com/github/github-mcp-server",
    30245
  ),
  famousRow(
    "playwright-mcp",
    "Microsoft's Playwright MCP server for browser automation through accessibility snapshots.",
    "https://github.com/microsoft/playwright-mcp",
    33158
  ),
  famousRow(
    "chrome-devtools-mcp",
    "Chrome DevTools for coding agents: console, network, performance, and page inspection.",
    "https://github.com/ChromeDevTools/chrome-devtools-mcp",
    42133
  ),
  famousRow(
    "mcp-toolbox-databases",
    "Google's MCP Toolbox for Databases across Postgres, MySQL, BigQuery, Redis, and more.",
    "https://github.com/googleapis/mcp-toolbox",
    15379
  ),
  famousRow(
    "figma-context-mcp",
    "Figma layout context for AI coding agents building UI from designs.",
    "https://github.com/GLips/Figma-Context-MCP",
    14901
  ),
  famousRow(
    "notion-mcp-server",
    "Notion's official MCP server for workspace pages, databases, and knowledge workflows.",
    "https://github.com/makenotion/notion-mcp-server",
    4368
  ),
  famousRow(
    "browserbase-mcp",
    "Cloud browser control for agents through Browserbase and Stagehand.",
    "https://github.com/browserbase/mcp-server-browserbase",
    3359
  ),
  famousRow(
    "supabase-mcp",
    "Connect AI assistants to Supabase project, database, and app-building workflows.",
    "https://github.com/supabase-community/supabase-mcp",
    2709
  ),
  famousRow(
    "apify-mcp",
    "Apify's MCP server for thousands of ready-made scrapers, crawlers, and automation actors.",
    "https://github.com/apify/apify-mcp-server",
    1283
  ),
  famousRow(
    "kubernetes-mcp",
    "Kubernetes management commands exposed to agents through kubectl-backed MCP tools.",
    "https://github.com/Flux159/mcp-server-kubernetes",
    1399
  ),
  famousRow(
    "sentry-mcp",
    "Sentry's MCP server for production error, issue, and observability workflows.",
    "https://github.com/getsentry/sentry-mcp",
    706
  ),
  famousRow(
    "official-mcp-servers",
    "The reference MCP server collection: filesystem, fetch, git, memory, sequential thinking, and time.",
    "https://github.com/modelcontextprotocol/servers",
    86412
  ),
];

export default async function McpsPage() {
  const h = await headers();
  after(() => track("mcps_view", { headers: h }));

  const [mcpBuilder, firecrawlMcp, playwright, linear, resend, printingPress, browserUse, higgsfieldMcp, runwayMcp] =
    await Promise.all([
      findApprovedByName("mcp-builder"),
      findApprovedByName("firecrawl-mcp"),
      findApprovedByName("playwright-skill"),
      findApprovedByName("linear-claude-skill"),
      findApprovedByName("resend-email-skill"),
      findApprovedByName("printingpress"),
      findApprovedByName("browser-use"),
      findApprovedByName("higgsfield-mcp"),
      findApprovedByName("runway-mcp"),
    ]);

  const powerhouseEntries: CollectionEntry[] = [
    skillRow(mcpBuilder, "mcp-builder", "Design and ship a Model Context Protocol server with a tool surface an agent can actually use."),
    skillRow(firecrawlMcp, "firecrawl-mcp", "Expose Firecrawl scraping, crawling, mapping, and extraction to an agent through MCP."),
    skillRow(playwright, "playwright-skill", "Give an agent a Playwright browser runner for end-to-end checks, screenshots, and custom web flows."),
    skillRow(linear, "linear-claude-skill", "Use Linear's official MCP server for issue, project, and workspace workflows."),
    skillRow(resend, "resend-email-skill", "Send and inspect Resend email resources through an MCP-backed Claude workflow."),
    skillRow(printingPress, "printingpress", "Generate an agent-native Go CLI and MCP server from an API spec, HAR file, or live website."),
    skillRow(browserUse, "browser-use", "Attach an agent to a real browser through MCP-style browser control and inspection tools."),
    skillRow(higgsfieldMcp, "higgsfield-mcp", "Generate images and videos with Higgsfield's full model roster — Seedance, Kling, Veo, Sora, Soul, Flux, and more — through the official hosted MCP."),
    skillRow(runwayMcp, "runway-mcp", "Run Runway Gen-3 and Gen-4 video models from an agent — text-to-video, image-to-video, and upscaling — through Runway's official MCP server."),
  ];

  const totalCount = powerhouseEntries.length + FAMOUS_MCP_ENTRIES.length;

  return (
    <div className="max-w-5xl mx-auto px-6 pt-12 pb-24">
      <CollectionHeader
        active="mcps"
        eyebrow="MCPs"
        title="Agent-callable tools, not pasted docs."
        description="MCP skills give agents real tool surfaces for browsers, APIs, SaaS apps, research, and custom workflows. Start here when the agent needs to act outside the prompt."
        countLabel={`${totalCount} mcps`}
      />

      <McpsSections
        powerhouseEntries={powerhouseEntries}
        famousEntries={FAMOUS_MCP_ENTRIES}
      />

      <section className="mt-16 border-t border-[color:var(--border)] pt-6">
        <h2 className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)]">
          How they compose
        </h2>
        <p className="text-[15px] text-[color:var(--fg-muted)] leading-relaxed mt-3 max-w-3xl">
          <a href="#mcp-builder" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">mcp-builder</a>{" "}
          designs the server,{" "}
          <a href="#firecrawl-mcp" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">firecrawl-mcp</a>{" "}
          brings in web content,{" "}
          <a href="#playwright-skill" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">playwright-skill</a>{" "}
          verifies browser flows,{" "}
          <a href="#linear-claude-skill" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">linear-claude-skill</a>{" "}
          and{" "}
          <a href="#resend-email-skill" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">resend-email-skill</a>{" "}
          connect SaaS work,{" "}
          <a href="#printingpress" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">printingpress</a>{" "}
          turns an API into a reusable CLI plus MCP server, and{" "}
          <a href="#higgsfield-mcp" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">higgsfield-mcp</a>{" "}
          and{" "}
          <a href="#runway-mcp" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">runway-mcp</a>{" "}
          add production-grade image and video generation to any agent pipeline.
        </p>
      </section>
    </div>
  );
}

function skillRow(
  entry: MarketplaceEntry | null,
  fallbackName: string,
  description: string
): CollectionEntry {
  return {
    name: entry?.skill.name ?? fallbackName,
    description: entry?.skill.description ?? description,
    audience: entry?.skill.audience ?? "general",
    category: entry?.skill.category ?? "tool",
    source: entry ? hostFromUrl(entry.sourceUrl) : "marketplace",
    href: entry ? `/marketplace/${entry.id}` : `/i/${fallbackName}`,
    repoUrl: entry?.skill.repoUrl,
    stars: entry?.stars,
    videoCount: entry?.skill.videoUrls.length ?? 0,
  };
}

function famousRow(
  name: string,
  description: string,
  repoUrl: string,
  stars: number
): CollectionEntry {
  return {
    name,
    description,
    audience: "ai",
    category: "tool",
    source: hostFromUrl(repoUrl),
    href: repoUrl,
    repoUrl,
    stars,
    videoCount: 0,
  };
}

function CollectionHeader({
  active,
  eyebrow,
  title,
  description,
  countLabel,
}: {
  active: "budget" | "mcps";
  eyebrow: string;
  title: string;
  description: string;
  countLabel: string;
}) {
  return (
    <>
      <Link
        href="/"
        className="mono text-[12px] text-[color:var(--fg-muted)] hover:text-[color:var(--accent)]"
      >
        ← all skills
      </Link>

      <div className="mt-6 mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)]">
        {eyebrow}
      </div>
      <div className="mt-2 flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-3xl sm:text-4xl tracking-[-0.02em] font-semibold">{title}</h1>
          <p className="text-[color:var(--fg-muted)] mt-3 leading-relaxed max-w-2xl">
            {description}
          </p>
        </div>
        <Link href="/submit" className="btn-accent rounded-md px-5 py-2.5 text-sm whitespace-nowrap">
          + Submit a skill
        </Link>
      </div>

      <div className="mt-10 flex items-baseline justify-between gap-4 flex-wrap border-b border-[color:var(--border)] pb-3">
        <div className="flex items-center gap-5 mono text-[12px]">
          <Link href="/" className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition">
            all
          </Link>
          <Link
            href="/budget"
            className={
              active === "budget"
                ? "text-[color:var(--accent)] underline underline-offset-4 decoration-1"
                : "text-[color:var(--accent)]/80 hover:text-[color:var(--accent)] transition"
            }
          >
            budget
          </Link>
          <Link
            href="/mcps"
            className={
              active === "mcps"
                ? "text-[color:var(--accent)] underline underline-offset-4 decoration-1"
                : "text-[color:var(--accent)]/80 hover:text-[color:var(--accent)] transition"
            }
          >
            mcps
          </Link>
        </div>
        <span className="mono text-[11px] text-[color:var(--fg-dim)] tabular-nums">
          {countLabel}
        </span>
      </div>
    </>
  );
}

function hostFromUrl(u: string): string {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return u;
  }
}
