import { promises as fs } from "node:fs";
import path from "node:path";

export interface BenchmarkEntry {
  label: string;
  sourceUrl: string;
  rawBytes: number;
  rawTokensEst: number;
  textChars: number;
  textTokensEst: number;
  skillChars: number;
  skillTokensEst: number;
  apiCount: number;
  gotchaCount: number;
  skillId: string | null;
  skillName: string;
}

export interface BenchmarkData {
  generatedAt: string;
  entries: BenchmarkEntry[];
}

export interface BenchmarkSummary {
  data: BenchmarkData;
  totals: {
    docs: number;
    rawTokens: number;
    textTokens: number;
    skillTokens: number;
    apis: number;
    compressionVsRaw: number;
    reductionVsTextPct: number;
  };
}

export async function loadBenchmarks(): Promise<BenchmarkSummary | null> {
  try {
    const file = path.join(process.cwd(), "data", "benchmarks.json");
    const raw = await fs.readFile(file, "utf-8");
    const data = JSON.parse(raw) as BenchmarkData;
    const totals = data.entries.reduce(
      (acc, e) => ({
        docs: acc.docs + 1,
        rawTokens: acc.rawTokens + e.rawTokensEst,
        textTokens: acc.textTokens + e.textTokensEst,
        skillTokens: acc.skillTokens + e.skillTokensEst,
        apis: acc.apis + e.apiCount,
      }),
      { docs: 0, rawTokens: 0, textTokens: 0, skillTokens: 0, apis: 0 }
    );
    return {
      data,
      totals: {
        ...totals,
        compressionVsRaw: totals.rawTokens / Math.max(totals.skillTokens, 1),
        reductionVsTextPct: (1 - totals.skillTokens / Math.max(totals.textTokens, 1)) * 100,
      },
    };
  } catch {
    return null;
  }
}
