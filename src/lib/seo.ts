import type { Metadata } from "next";

import { SITE_URL } from "@/content/learn";

export function pageMeta(opts: { title: string; description: string; path: string }): Metadata {
  const url = `${SITE_URL}${opts.path}`;
  return {
    title: { absolute: `${opts.title} · EngineerOS` },
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      title: opts.title,
      description: opts.description,
      type: "website",
      url,
      siteName: "EngineerOS",
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: ["/og-image.png"],
    },
  };
}
