import { Suspense } from "react";

import { ProjectPage } from "@/components/project/ProjectPage";
import { PageLoader } from "@/components/shell/PageLoader";

export default async function SingleProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={<PageLoader label="Loading project…" />}>
      <ProjectPage projectId={id} />
    </Suspense>
  );
}
