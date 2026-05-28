export function MarketplaceSearch() {
  return (
    <div id="marketplace-search" data-search-root>
      <div className="input-shell rounded-lg flex items-center gap-2 p-1 mb-3">
        <span className="mono text-[color:var(--fg-dim)] text-xs pl-3">⌕</span>
        <input
          name="q"
          type="search"
          autoComplete="off"
          placeholder='Search by job: "turn transcript into article"'
          className="flex-1 bg-transparent outline-none text-[14px] mono py-2.5 pr-2 placeholder:text-[color:var(--fg-dim)]"
        />
        <button
          type="button"
          data-clear
          hidden
          className="text-xs text-[color:var(--fg-dim)] hover:text-[color:var(--fg)] px-3"
        >
          clear
        </button>
      </div>

      <div data-chips className="mb-4 flex flex-wrap gap-2">
        {[
          "turn transcript into article",
          "review PR",
          "generate HTML",
          "research last 72 hours",
        ].map((chip) => (
          <button
            key={chip}
            type="button"
            data-chip={chip}
            className="mono text-[11px] rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] transition"
          >
            {chip}
          </button>
        ))}
      </div>

      <div data-status className="mb-3 flex items-center gap-2 text-[11px] mono text-[color:var(--fg-dim)]" hidden />
      <div data-results className="mb-6 space-y-2" />
      <MarketplaceSearchScript />
    </div>
  );
}

function MarketplaceSearchScript() {
  return (
    <script
      type="module"
      dangerouslySetInnerHTML={{
        __html: String.raw`
(() => {
  const root = document.querySelector("[data-search-root]");
  if (!root) return;

  const input = root.querySelector("input[name='q']");
  const clear = root.querySelector("[data-clear]");
  const chips = root.querySelector("[data-chips]");
  const status = root.querySelector("[data-status]");
  const results = root.querySelector("[data-results]");
  let timer = 0;
  let ctrl = null;

  const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);

  const scoreColor = (score) => {
    if (score >= 0.85) return ["var(--accent)", "#0b0d10"];
    if (score >= 0.65) return ["color-mix(in oklab, var(--accent) 60%, var(--surface))", "#0b0d10"];
    if (score >= 0.45) return ["color-mix(in oklab, var(--accent) 25%, var(--surface))", "var(--fg)"];
    return ["var(--bg-elevated)", "var(--fg)"];
  };

  const renderStatus = (html) => {
    status.hidden = !html;
    status.innerHTML = html || "";
  };

  const renderResults = (items) => {
    if (!items.length) {
      results.innerHTML = '<div class="card p-6 text-center text-sm text-[color:var(--fg-muted)]">No matches. Try different words - semantic search understands synonyms.</div>';
      return;
    }
    results.innerHTML = items.map((item) => {
      const [bg, color] = scoreColor(item.score);
      return '<a href="/marketplace/' + encodeURIComponent(item.id) + '" class="card p-4 flex items-start gap-4 hover:border-[color:var(--accent)] transition group">' +
        '<div class="mono text-[10px] tracking-wider px-2 py-1 rounded-md self-start mt-0.5" style="background:' + bg + ';color:' + color + '">' + esc(Number(item.score).toFixed(2)) + '</div>' +
        '<div class="flex-1 min-w-0">' +
        '<div class="flex items-center gap-2 flex-wrap">' +
        '<span class="mono text-[14px] font-semibold">' + esc(item.name) + '</span>' +
        '<span class="tag">' + esc(item.category) + '</span>' +
        '</div>' +
        '<div class="text-[13px] text-[color:var(--fg-muted)] line-clamp-2 mt-1">' + esc(item.description) + '</div>' +
        '</div>' +
        '</a>';
    }).join("");
  };

  const search = () => {
    const q = input.value.trim();
    clear.hidden = !q;
    chips.hidden = !!q;
    window.clearTimeout(timer);
    if (ctrl) ctrl.abort();

    if (!q) {
      renderStatus("");
      results.innerHTML = "";
      return;
    }

    ctrl = new AbortController();
    renderStatus('<span class="flex items-center gap-1.5"><span class="dot pulse-dot"></span> searching...</span>');
    timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: q }),
          signal: ctrl.signal
        });
        const data = await res.json();
        const mode = data.mode === "semantic" ? "HydraDB · semantic" : "fallback · substring";
        const tag = data.mode === "semantic" ? "tag tag-accent" : "tag";
        const count = data.results.length;
        renderStatus('<span class="' + tag + '">' + mode + '</span><span>' + count + ' result' + (count === 1 ? '' : 's') + '</span>');
        renderResults(data.results);
      } catch (error) {
        if (error.name !== "AbortError") {
          renderStatus('<span class="tag">fallback · substring</span><span>0 results</span>');
          renderResults([]);
        }
      }
    }, 220);
  };

  input.addEventListener("input", search);
  clear.addEventListener("click", () => {
    input.value = "";
    input.focus();
    search();
  });
  chips.addEventListener("click", (event) => {
    const chip = event.target instanceof Element
      ? event.target.closest("[data-chip]")
      : null;
    if (!chip) return;
    input.value = chip.dataset.chip;
    input.focus();
    search();
  });
})();
`,
      }}
    />
  );
}
