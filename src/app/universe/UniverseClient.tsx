"use client";

import dynamic from "next/dynamic";
import type { UniverseSkill } from "@/lib/universe";

const Galaxy = dynamic(() => import("./Galaxy"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#06070a]">
      <div className="text-center">
        <div className="mono text-sm text-[color:var(--accent)] animate-pulse">
          igniting skill universe…
        </div>
        <div className="mono text-[11px] text-[color:var(--fg-dim)] mt-2">
          loading three.js · arranging constellations
        </div>
      </div>
    </div>
  ),
});

export default function UniverseClient({ skills }: { skills: UniverseSkill[] }) {
  return <Galaxy skills={skills} />;
}
