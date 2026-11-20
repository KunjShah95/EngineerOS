import { MetadataRoute } from "next";

import { ALL_TOPICS, TRACKS } from "@/content/learn";
import { getSortedPosts } from "@/content/posts";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://engineeros-delta.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getSortedPosts();

  const learn: MetadataRoute.Sitemap = [
    { url: `${BASE}/learn`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.95 },
    { url: `${BASE}/map`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/connect`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    ...TRACKS.map((t) => ({
      url: `${BASE}/learn/${t.id}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...ALL_TOPICS.map((t) => ({
      url: `${BASE}/learn/${t.track}/${t.id}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];

  return [
    ...learn,
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE}/blog`,
      // The index is as fresh as its newest post.
      lastModified: new Date(posts[0]?.updated ?? Date.now()),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...posts.map((post) => ({
      url: `${BASE}/blog/${post.slug}`,
      lastModified: new Date(post.updated),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: `${BASE}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE}/compare/notion-vs-engineeros`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${BASE}/compare/obsidian-vs-engineeros`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${BASE}/guides/building-a-second-brain`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];
}
