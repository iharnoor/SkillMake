"use client";

import { useState } from "react";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Login failed.");
        return;
      }
      // Same-origin redirect; sanitise to a path we control.
      const dest = nextPath.startsWith("/admin") ? nextPath : "/admin";
      window.location.replace(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="password"
        autoComplete="current-password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Admin token"
        className="input-shell rounded-md w-full px-3 py-2.5 mono text-[13px] outline-none"
        autoFocus
        disabled={pending}
      />
      {error && (
        <div className="mono text-[11px] text-[color:var(--danger)]">{error}</div>
      )}
      <button
        type="submit"
        disabled={pending || token.length < 8}
        className="btn-accent rounded-md w-full px-4 py-2.5 text-sm"
      >
        {pending ? "Verifying…" : "Sign in"}
      </button>
    </form>
  );
}
