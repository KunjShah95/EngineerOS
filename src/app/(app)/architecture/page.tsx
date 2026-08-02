import { Suspense } from "react";

import { ResourceList } from "@/components/resource/ResourceList";
import { PageLoader } from "@/components/shell/PageLoader";

export default function ArchitecturePage() {
  return (
    <Suspense fallback={<PageLoader label="Loading…" />}>
      <ResourceList
        kind="architecture"
        title="Architecture"
        emptyDescription="Capture design decisions and system notes."
      />
    </Suspense>
  );
}