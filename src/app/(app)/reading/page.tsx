import { Suspense } from "react";
import { BookOpenText } from "lucide-react";

import { ResourceList } from "@/components/resource/ResourceList";
import { PageLoader } from "@/components/shell/PageLoader";

export default function ReadingPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading…" />}>
      <ResourceList
        kind="reading"
        icon={BookOpenText}
        title="Reading"
        emptyDescription="Build a reading list. Track what you want, are reading, or finished."
      />
    </Suspense>
  );
}