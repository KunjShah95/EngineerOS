import { Suspense } from "react";

import { ResourceDetail } from "@/components/resource/ResourceDetail";
import { PageLoader } from "@/components/shell/PageLoader";

export default async function BookmarksDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageLoader label="Loading…" />}>
      <ResourceDetail resourceId={id} kind="bookmark" />
    </Suspense>
  );
}