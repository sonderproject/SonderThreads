import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { ALL_SEO_PAGES } from "@/lib/seo-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...ALL_SEO_PAGES.map((p) => ({
      url: `${SITE_URL}${p.path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...["privacy", "terms", "account-deletion"].map((path) => ({
      url: `${SITE_URL}/${path}`,
      lastModified: new Date(),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
