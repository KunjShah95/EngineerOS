import { Suspense } from "react";

import { ResourceList } from "@/components/resource/ResourceList";
import { PageLoader } from "@/components/shell/PageLoader";

export default function ReadingPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading…" />}>
      <ResourceList
        kind="reading"
        title="Reading"
        emptyDescription="Build a reading list. Track what you want, are reading, or finished."
      />
    </Suspense>
  );
}