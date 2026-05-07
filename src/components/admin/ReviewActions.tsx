"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReviewActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (kind: "approve" | "reject") => {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/admin/skills/${id}/${kind}`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Action failed.");
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => act("approve")}
        disabled={busy !== null}
        className="btn-accent rounded-md px-4 py-1.5 text-xs"
      >
        {busy === "approve" ? "Approving…" : "Approve & index"}
      </button>
      <button
        onClick={() => act("reject")}
        disabled={busy !== null}
        className="btn-ghost rounded-md px-4 py-1.5 text-xs"
      >
        {busy === "reject" ? "Rejecting…" : "Reject"}
      </button>
      {error && <span className="mono text-[11px] text-[color:var(--danger)]">{error}</span>}
    </div>
  );
}
