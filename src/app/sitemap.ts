import type { MetadataRoute } from "next";
import { listSkills } from "@/lib/storage";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  {
    url: SITE_URL,
    changeFrequency: "daily",
    priority: 1,
  },
  {
    url: `${SITE_URL}/mcps`,
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    url: `${SITE_URL}/tricks`,
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    url: `${SITE_URL}/submit`,
    changeFrequency: "monthly",
    priority: 0.5,
  },
  {
    url: `${SITE_URL}/security`,
    changeFrequency: "monthly",
    priority: 0.4,
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const skills = await listSkills();

  return [
    ...STATIC_ROUTES,
    ...skills.map((entry) => ({
      url: `${SITE_URL}/marketplace/${entry.id}`,
      lastModified: new Date(entry.createdAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
