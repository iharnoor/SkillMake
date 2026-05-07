import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

const MAX_BYTES = 2_500_000;
const MAX_CHARS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;

const PRIVATE_HOST_RE =
  /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc00:|fe80:|metadata\.google\.internal$)/i;

export class ExtractError extends Error {
  constructor(message: string, public code: "INVALID_URL" | "BLOCKED" | "FETCH_FAILED" | "TOO_LARGE" | "EMPTY") {
    super(message);
  }
}

export interface Extracted {
  url: string;
  finalUrl: string;
  title: string;
  byline: string | null;
  text: string;
  bytes: number;
}

export async function extractDocs(rawUrl: string): Promise<Extracted> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ExtractError("Not a valid URL.", "INVALID_URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ExtractError("Only http(s) URLs are supported.", "INVALID_URL");
  }
  if (PRIVATE_HOST_RE.test(url.hostname)) {
    throw new ExtractError("Private/internal hosts are blocked.", "BLOCKED");
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent": "SkillMake/1.0 (+https://skillmake.xyz)",
        accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (e) {
    throw new ExtractError(`Fetch failed: ${(e as Error).message}`, "FETCH_FAILED");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new ExtractError(`Source returned ${res.status}.`, "FETCH_FAILED");

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("html") && !contentType.includes("text")) {
    throw new ExtractError(`Unsupported content-type: ${contentType}`, "FETCH_FAILED");
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    throw new ExtractError("Page too large (>2.5MB).", "TOO_LARGE");
  }
  const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);

  const { document } = parseHTML(html);
  stripDangerousNodes(document as unknown as Document);

  // Capture every <pre> code block (with its preceding heading) BEFORE
  // Readability runs — Readability often discards code blocks on technical
  // docs sites (sandboxed tabs, syntax-highlighter wrappers, etc.).
  const codeBlocks = extractCodeBlocks(document as unknown as Document);

  const reader = new Readability(document as unknown as Document, { keepClasses: false });
  const article = reader.parse();

  const titleFromDom = document.querySelector("title")?.textContent?.trim() ?? "";
  const title = (article?.title || titleFromDom || url.hostname).slice(0, 180);
  const byline = article?.byline?.slice(0, 120) ?? null;

  const proseText = (article?.textContent ?? extractFallback(document as unknown as Document))
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const codeText =
    codeBlocks.length > 0
      ? "\n\n=== CODE BLOCKS (verbatim from source) ===\n\n" +
        codeBlocks
          .map((b) => (b.heading ? `## ${b.heading}\n\n\`\`\`\n${b.code}\n\`\`\`` : `\`\`\`\n${b.code}\n\`\`\``))
          .join("\n\n")
      : "";

  let text = (proseText + codeText).trim();

  text = stripInjectionPatterns(text);

  if (!text || text.length < 80) {
    throw new ExtractError("Could not extract meaningful content from page.", "EMPTY");
  }
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);

  return {
    url: url.toString(),
    finalUrl: res.url || url.toString(),
    title,
    byline,
    text,
    bytes: buf.byteLength,
  };
}

function stripDangerousNodes(doc: Document): void {
  const tags = ["script", "style", "noscript", "iframe", "object", "embed", "template"];
  for (const tag of tags) {
    for (const el of Array.from(doc.getElementsByTagName(tag))) el.remove();
  }
  for (const el of Array.from(doc.querySelectorAll("[hidden], [aria-hidden='true']"))) {
    el.remove();
  }
  for (const el of Array.from(doc.querySelectorAll("[style]"))) {
    const style = el.getAttribute("style") ?? "";
    if (/display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0/i.test(style)) {
      el.remove();
    }
  }
  for (const c of Array.from(doc.childNodes)) {
    walkComments(c, (node) => node.parentNode?.removeChild(node));
  }
}

function walkComments(node: Node, fn: (n: Node) => void): void {
  if (node.nodeType === 8) fn(node);
  for (const child of Array.from(node.childNodes)) walkComments(child, fn);
}

function extractFallback(doc: Document): string {
  return (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function extractCodeBlocks(doc: Document): { heading: string | null; code: string }[] {
  const out: { heading: string | null; code: string }[] = [];
  const seen = new Set<string>();
  const pres = Array.from(doc.querySelectorAll("pre"));
  for (const pre of pres) {
    const code = (pre.textContent ?? "").replace(/ /g, " ").replace(/\s+$/g, "").trim();
    if (code.length < 8) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({ heading: nearestHeading(pre as unknown as Element), code: code.slice(0, 4000) });
  }
  return out.slice(0, 40);
}

function nearestHeading(el: Element): string | null {
  let cursor: Element | null = el;
  while (cursor) {
    let prev = cursor.previousElementSibling;
    while (prev) {
      if (/^H[1-6]$/.test(prev.tagName)) {
        const t = (prev.textContent ?? "").trim();
        if (t) return t.slice(0, 140);
      }
      prev = prev.previousElementSibling;
    }
    cursor = cursor.parentElement;
  }
  return null;
}

const INJECTION_LINE_RE =
  /^\s*(ignore (all|previous|the above) (instructions|prompts?)|disregard (all|previous|prior).*|system\s*[:>].*|you are now\b.*|new instructions\b.*|forget (everything|all).*)/i;

function stripInjectionPatterns(text: string): string {
  return text
    .split("\n")
    .filter((line) => !INJECTION_LINE_RE.test(line))
    .join("\n");
}
