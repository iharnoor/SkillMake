const SPARK_WIDTH = 108;
const SPARK_HEIGHT = 28;
const SPARK_PAD_Y = 3;

export function InstallTrend({ installs }: { installs?: number[] }) {
  if (!installs || installs.length === 0) {
    return (
      <div
        className="mono text-[11px] text-[color:var(--fg-dim)] self-start mt-1"
        title="Install trend unavailable"
      >
        <span className="lg:hidden text-[10px] uppercase tracking-wider mr-2">8w trend</span>—
      </div>
    );
  }

  const max = Math.max(...installs, 1);
  const stepX = installs.length > 1 ? SPARK_WIDTH / (installs.length - 1) : SPARK_WIDTH;
  const usableH = SPARK_HEIGHT - SPARK_PAD_Y * 2;

  const points = installs.map((count, index) => {
    const x = index * stepX;
    const y = SPARK_HEIGHT - SPARK_PAD_Y - (count / max) * usableH;
    return [x, y] as const;
  });

  const path = smoothPath(points);
  const hasAnyInstalls = installs.some((c) => c > 0);

  return (
    <div
      className="h-7 w-[6.75rem] self-start"
      aria-label={`Eight-week install trend: ${installs.join(", ")}`}
      title={`Last eight weeks: ${installs.join(" / ")} installs`}
    >
      <svg
        viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible"
        aria-hidden
      >
        <path
          d={path}
          fill="none"
          stroke={hasAnyInstalls ? "var(--accent)" : "var(--border-strong)"}
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

export function InstallCount({
  installs,
  className,
}: {
  installs?: number;
  className?: string;
}) {
  const base =
    "mono text-[12px] tabular-nums text-[color:var(--fg-muted)] lg:text-right self-start mt-1";
  if (installs === undefined) {
    return (
      <div className={[base, className].filter(Boolean).join(" ")}>
        <span className="lg:hidden text-[10px] uppercase tracking-wider text-[color:var(--fg-dim)] mr-2">
          installs
        </span>
        —
      </div>
    );
  }
  return (
    <div className={[base, className].filter(Boolean).join(" ")}>
      <span className="lg:hidden text-[10px] uppercase tracking-wider text-[color:var(--fg-dim)] mr-2">
        installs
      </span>
      <span className="inline-flex items-center gap-1 lg:justify-end">
        <CheckIcon />
        {formatInstallCount(installs)}
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="11"
      height="11"
      aria-hidden
      className="shrink-0 text-[color:var(--fg-dim)]"
    >
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M5.5 8.25l1.75 1.75 3.25-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function formatInstallCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function smoothPath(points: ReadonlyArray<readonly [number, number]>): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M ${x} ${y} L ${x + 0.01} ${y}`;
  }
  const [first, ...rest] = points;
  let d = `M ${first[0]} ${first[1]}`;
  for (let i = 0; i < rest.length; i++) {
    const prev = i === 0 ? first : rest[i - 1];
    const curr = rest[i];
    const cpx = (prev[0] + curr[0]) / 2;
    d += ` Q ${cpx} ${prev[1]} ${(prev[0] + curr[0]) / 2} ${(prev[1] + curr[1]) / 2}`;
    d += ` T ${curr[0]} ${curr[1]}`;
  }
  return d;
}
