import { Suspense } from "react";
import { Network } from "lucide-react";

import { ResourceList } from "@/components/resource/ResourceList";
import { PageLoader } from "@/components/shell/PageLoader";

export default function ArchitecturePage() {
  return (
    <Suspense fallback={<PageLoader label="Loading…" />}>
      <ResourceList
        kind="architecture"
        icon={Network}
        title="Architecture"
        emptyDescription="Capture design decisions and system notes."
      />
    </Suspense>
  );
}