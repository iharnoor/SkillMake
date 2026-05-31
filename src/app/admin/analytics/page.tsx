import Link from "next/link";
import { getAnalyticsDashboardData, type Bar, type Point } from "@/lib/analytics-dashboard";
import { LogoutButton } from "@/components/admin/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const data = await getAnalyticsDashboardData();

  if (!data.ok) {
    return (
      <div className="max-w-5xl mx-auto px-6 pt-12 pb-20">
        <AdminAnalyticsHeader />
        <div className="card p-8">
          <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--warn)] mb-3">
            Dashboard not connected
          </div>
          <h2 className="text-2xl font-semibold tracking-tight mb-3">
            Cloudflare Analytics Engine access is missing.
          </h2>
          <p className="text-sm text-[color:var(--fg-muted)] max-w-2xl leading-relaxed">
            {data.message} Create a token with Account Analytics:Read and set it with{" "}
            <code className="mono text-[12px] text-[color:var(--fg)]">
              wrangler secret put CLOUDFLARE_ANALYTICS_API_TOKEN
            </code>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-16">
      <div className="max-w-[1800px] mx-auto">
        <AdminAnalyticsHeader generatedAt={data.generatedAt} />

        <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
          <Kpi label="Total installs" value={data.totals.installs} tone="hot" />
          <Kpi label="Unique visitors" value={data.totals.uniqueVisitors} tone="warm" />
          <Kpi label="Total events" value={data.totals.events} tone="hot" />
          <Kpi label="API errors" value={data.totals.apiErrors} tone={data.totals.apiErrors > 0 ? "danger" : "good"} />
          <Kpi label="Agent installs" value={data.totals.agentInstalls} tone="warm" />
          <Kpi label="Human installs" value={data.totals.browserInstalls} tone="good" />
          <Kpi
            label="Human share of installs"
            value={data.totals.humanInstallPct == null ? "n/a" : `${data.totals.humanInstallPct}%`}
            tone="purple"
          />
          <Kpi label="Crawler / terminal noise" value={data.totals.crawlerInstalls} tone="danger" />
        </section>

        <section className="grid xl:grid-cols-[2fr_1fr] gap-3 mb-3">
          <Panel title="Installs per day" subtitle="14d">
            <SparkBars points={data.series.installsByDay} />
          </Panel>
          <Panel title="UA split" subtitle="installs, 14d">
            <HorizontalBars bars={data.bars.uaSplit} compact />
          </Panel>
        </section>

        <section className="grid xl:grid-cols-2 gap-3 mb-3">
          <Panel title="Hourly install pulse" subtitle="7d">
            <LineBars points={data.series.installsByHour} />
          </Panel>
          <Panel title="Errors per hour" subtitle="7d">
            <LineBars points={data.series.errorsByHour} danger />
          </Panel>
        </section>

        <section className="grid xl:grid-cols-2 gap-3 mb-3">
          <Panel title="Top installs" subtitle="all time">
            <HorizontalBars bars={data.bars.topInstalls} />
          </Panel>
          <Panel title="Top marketplace views" subtitle="14d">
            <HorizontalBars bars={data.bars.topViews} />
          </Panel>
          <Panel title="Agent installs" subtitle="curl + bot + other, 14d">
            <HorizontalBars bars={data.bars.topAgentInstalls} />
          </Panel>
          <Panel title="Human installs" subtitle="browser, 14d">
            <HorizontalBars bars={data.bars.topBrowserInstalls} />
          </Panel>
          <Panel title="GitHub source clicks" subtitle="14d">
            <HorizontalBars bars={data.bars.topClicks} />
          </Panel>
          <Panel title="Countries" subtitle="installs, 14d">
            <HorizontalBars bars={data.bars.topCountries} compact />
          </Panel>
        </section>

        <section className="grid xl:grid-cols-3 gap-3 mb-3">
          <Panel title="Funnel" subtitle="14d">
            <HorizontalBars bars={data.bars.funnel} compact />
          </Panel>
          <Panel title="Dwell distribution" subtitle="14d">
            <HorizontalBars bars={data.bars.dwell} compact />
          </Panel>
          <Panel title="Scroll depth" subtitle="14d">
            <HorizontalBars bars={data.bars.scroll} compact />
          </Panel>
        </section>

        <section className="grid xl:grid-cols-2 gap-3 mb-3">
          <Panel title="Event mix" subtitle="14d">
            <HorizontalBars bars={data.bars.topEvents} />
          </Panel>
          <Panel title="Last 24h event mix" subtitle="freshness check">
            <HorizontalBars bars={data.tables.recentEventMix} />
          </Panel>
        </section>

        <section className="grid xl:grid-cols-2 gap-3 mb-3">
          <Panel title="Daily unique visitors" subtitle="14d">
            <SparkBars points={data.series.uniquesByDay} />
          </Panel>
          <Panel title="Audience demand" subtitle="added skills, 28d">
            <HorizontalBars bars={data.bars.audienceDemand} compact emptyLabel="No catalog events yet" />
          </Panel>
        </section>

        <Panel title="API errors by code" subtitle="14d">
          <div className="overflow-x-auto">
            <table className="w-full mono text-[11px]">
              <thead className="text-[color:var(--fg-dim)]">
                <tr className="border-b border-[color:var(--border)]">
                  <th className="text-left py-2 font-normal">event</th>
                  <th className="text-left py-2 font-normal">slug</th>
                  <th className="text-right py-2 font-normal">status</th>
                  <th className="text-right py-2 font-normal">hits</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.errors.length === 0 ? (
                  <tr>
                    <td className="py-6 text-[color:var(--accent)]" colSpan={4}>
                      No errors in the current window.
                    </td>
                  </tr>
                ) : (
                  data.tables.errors.map((row) => (
                    <tr key={`${row.event}-${row.slug}-${row.status}`} className="border-b border-[color:var(--border)]/70">
                      <td className="py-2 text-[color:var(--danger)]">{row.event}</td>
                      <td className="py-2 text-[color:var(--fg-muted)]">{row.slug || "-"}</td>
                      <td className="py-2 text-right">{row.status}</td>
                      <td className="py-2 text-right text-[color:var(--fg)]">{row.hits}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AdminAnalyticsHeader({ generatedAt }: { generatedAt?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
      <div>
        <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] mb-2">
          Analytics wallboard
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">SkillMake telemetry.</h1>
        <p className="text-sm text-[color:var(--fg-muted)] mt-2">
          Same source as Grafana, tuned for the admin surface.
          {generatedAt ? (
            <span className="mono text-[11px] text-[color:var(--fg-dim)] ml-2">
              refreshed {new Date(generatedAt).toLocaleTimeString()}
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex gap-2">
        <Link href="/admin" className="btn-ghost rounded-md px-3 py-2 text-sm">
          Queue
        </Link>
        <LogoutButton />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "good" | "warm" | "hot" | "danger" | "purple";
}) {
  const toneClass = {
    good: "text-[#7ee787]",
    warm: "text-[#ffb547]",
    hot: "text-[#ff5364]",
    danger: "text-[color:var(--danger)]",
    purple: "text-[#c678dd]",
  }[tone];
  return (
    <div className="card px-4 py-3 min-h-[96px] flex flex-col justify-between">
      <div className="mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--fg-dim)]">
        {label}
      </div>
      <div className={`mono text-3xl sm:text-4xl font-semibold tabular-nums ${toneClass}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-4 min-h-[220px]">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="mono text-[12px] text-[color:var(--fg)]">{title}</h2>
        <div className="mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--fg-dim)]">
          {subtitle}
        </div>
      </div>
      {children}
    </section>
  );
}

function SparkBars({ points }: { points: Point[] }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div className="h-[170px] flex items-end gap-1 border-b border-[color:var(--border)]">
      {points.length === 0 ? (
        <Empty label="No data" />
      ) : (
        points.map((point) => (
          <div key={point.label} className="flex-1 min-w-[8px] flex flex-col items-center justify-end gap-2">
            <div
              className="w-full rounded-t-sm bg-[linear-gradient(180deg,#ff5364_0%,#7ee787_100%)] min-h-[2px]"
              style={{ height: `${Math.max(3, (point.value / max) * 145)}px` }}
              title={`${point.label}: ${point.value}`}
            />
            <div className="mono text-[9px] text-[color:var(--fg-dim)] rotate-[-35deg] origin-top-left h-5">
              {point.label}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function LineBars({ points, danger = false }: { points: Point[]; danger?: boolean }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  if (points.length > 0 && points.length < 8) {
    return (
      <HorizontalBars
        bars={points.map((point) => ({ label: point.label, value: point.value }))}
        compact
      />
    );
  }
  return (
    <div className="h-[170px] flex items-end gap-[3px] border-b border-[color:var(--border)]">
      {points.length === 0 ? (
        <Empty label="No data" />
      ) : (
        points.map((point, index) => (
          <div
            key={`${point.label}-${index}`}
            className={`flex-1 min-w-[2px] rounded-t-sm ${danger ? "bg-[color:var(--danger)]" : "bg-[#7ee787]"}`}
            style={{ height: `${Math.max(2, (point.value / max) * 150)}px`, opacity: 0.42 + (point.value / max) * 0.58 }}
            title={`${point.label}: ${point.value}`}
          />
        ))
      )}
    </div>
  );
}

function HorizontalBars({
  bars,
  compact = false,
  emptyLabel = "No data",
}: {
  bars: Bar[];
  compact?: boolean;
  emptyLabel?: string;
}) {
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  if (bars.length === 0) return <Empty label={emptyLabel} />;
  return (
    <div className={compact ? "space-y-2" : "space-y-[7px]"}>
      {bars.map((bar) => (
        <div key={bar.label} className="grid grid-cols-[minmax(90px,0.38fr)_minmax(0,1fr)_5ch] gap-3 items-center">
          <div className="mono text-[10px] text-[color:var(--fg-muted)] truncate" title={bar.label}>
            {bar.label}
          </div>
          <div className="h-3 bg-[color:var(--bg-elevated)] border border-[color:var(--border)] overflow-hidden">
            <div
              className="h-full bg-[linear-gradient(90deg,#7ee787_0%,#ffb547_62%,#ff5364_100%)]"
              style={{ width: `${Math.max(2, (bar.value / max) * 100)}%` }}
            />
          </div>
          <div className="mono text-[10px] text-right tabular-nums text-[color:var(--fg)]">
            {bar.value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="h-full min-h-[120px] flex items-center justify-center text-[color:var(--accent)] mono text-sm">
      {label}
    </div>
  );
}
