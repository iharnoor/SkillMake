import type { Metadata } from "next";
import { loadUniverseSkills } from "@/lib/universe";
import UniverseClient from "./UniverseClient";

export const metadata: Metadata = {
  title: "Skill Universe — explore the skillmake catalog in 3D",
  description:
    "A 3D galaxy of every reviewed agent skill. Orbit, zoom, and click from skill to skill to discover what your agent can learn next.",
};

export default async function UniversePage() {
  const skills = await loadUniverseSkills();
  return <UniverseClient skills={skills} />;
}
