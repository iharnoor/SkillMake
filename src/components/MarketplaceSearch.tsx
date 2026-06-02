interface SearchEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  audience: string;
  href: string;
}

export function MarketplaceSearch({ entries }: { entries: SearchEntry[] }) {
  return (
    <div id="marketplace-search" data-search-root>
      <div className="input-shell rounded-md flex items-center gap-2 px-3 py-2">
        <span className="mono text-[color:var(--fg-dim)] text-xs">⌕</span>
        <input
          name="q"
          type="search"
          autoComplete="off"
          placeholder="Search skills"
          className="flex-1 bg-transparent outline-none text-[13px] mono py-1 placeholder:text-[color:var(--fg-dim)]"
        />
      </div>

      <div data-status className="mt-2 text-[11px] mono text-[color:var(--fg-dim)]" hidden />
      <div data-results className="mt-2" />
      <MarketplaceSearchScript entries={entries} />
    </div>
  );
}

function MarketplaceSearchScript({ entries }: { entries: SearchEntry[] }) {
  const serializedEntries = JSON.stringify(entries).replace(/</g, "\\u003c");

  return (
    <script
      type="module"
      dangerouslySetInnerHTML={{
        __html: String.raw`
(() => {
  const entries = ${serializedEntries};
  const root = document.querySelector("[data-search-root]");
  if (!root) return;

  const input = root.querySelector("input[name='q']");
  const status = root.querySelector("[data-status]");
  const results = root.querySelector("[data-results]");

  const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);

  const renderStatus = (html) => {
    status.hidden = !html;
    status.innerHTML = html || "";
  };

  const renderPayload = (data) => {
    const count = data.results.length;
    renderStatus(count ? count + ' match' + (count === 1 ? '' : 'es') : 'No matches');
    renderResults(data.results);
  };

  const localSearch = (query) => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];

    return entries
      .map((item) => {
        const name = item.name.toLowerCase();
        const category = item.category.toLowerCase();
        const audience = item.audience.toLowerCase();
        const description = item.description.toLowerCase();
        const haystack = name + " " + category + " " + audience + " " + description;
        if (!terms.every((term) => haystack.includes(term))) return null;

        let score = 0;
        for (const term of terms) {
          if (name === term) score += 8;
          else if (name.startsWith(term)) score += 6;
          else if (name.includes(term)) score += 4;
          if (category.includes(term) || audience.includes(term)) score += 2;
          if (description.includes(term)) score += 1;
        }
        return { ...item, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 10);
  };

  const renderResults = (items) => {
    if (!items.length) {
      results.innerHTML = "";
      return;
    }
    results.innerHTML = items.map((item) => {
      return '<a href="' + esc(item.href) + '" class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2 border-b border-[color:var(--border)] hover:text-[color:var(--accent)] transition">' +
        '<div class="min-w-0">' +
        '<div class="mono text-[13px] truncate">' + esc(item.name) + '</div>' +
        '<div class="text-[12px] text-[color:var(--fg-muted)] line-clamp-1 mt-0.5">' + esc(item.description) + '</div>' +
        '</div>' +
        '<div class="mono text-[10px] text-[color:var(--fg-dim)] self-start mt-0.5">' + esc(item.category) + '</div>' +
        '</a>';
    }).join("");
  };

  const search = () => {
    const q = input.value.trim();

    if (!q) {
      renderStatus("");
      results.innerHTML = "";
      return;
    }

    renderPayload({ results: localSearch(q) });
  };

  input.addEventListener("input", search);
})();
`,
      }}
    />
  );
}
