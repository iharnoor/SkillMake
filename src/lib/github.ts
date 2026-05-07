import { getEnv } from "./env";
import { parseGithubRepo } from "./skill-schema";

/**
 * Fetch GitHub stargazer count for a repo. Best-effort:
 *   - returns null on any error (rate limit, 404, network, malformed URL)
 *   - timeouts at 5s
 *   - uses GITHUB_TOKEN when set (5000 req/hr instead of 60)
 *
 * We deliberately do not throw — callers should treat null as "stars unknown"
 * and continue rather than failing approval.
 */
export async function fetchRepoStars(repoUrl: string): Promise<number | null> {
  const parsed = parseGithubRepo(repoUrl);
  if (!parsed) return null;
  const env = await getEnv();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "SkillMake/1.0 (+https://skillmake.xyz)",
    };
    if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;

    const res = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
      { signal: ctrl.signal, headers, redirect: "follow" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Compact display: 1240 → "1.2k", 1_400_000 → "1.4M". */
export function formatStars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}
