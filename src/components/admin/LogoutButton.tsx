"use client";

import { useState } from "react";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      window.location.replace("/admin/login");
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="btn-ghost rounded-md px-3 py-1.5 text-xs"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
