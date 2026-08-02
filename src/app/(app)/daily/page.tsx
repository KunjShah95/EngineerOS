"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

import { PageLoader } from "@/components/shell/PageLoader";

// Client-side redirect to today's note: a server-side `redirect()` in a
// streamed response is only embedded in the RSC payload and does not reliably
// fire on hard navigation, so we navigate explicitly on mount.
export default function DailyIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/daily/${format(new Date(), "yyyy-MM-dd")}`);
  }, [router]);

  return <PageLoader label="Opening today's note…" />;
}
