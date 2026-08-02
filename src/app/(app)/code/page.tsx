import { Suspense } from "react";

import { ResourceList } from "@/components/resource/ResourceList";
import { PageLoader } from "@/components/shell/PageLoader";

export default function CodePage() {
  return (
    <Suspense fallback={<PageLoader label="Loading…" />}>
      <ResourceList
        kind="code"
        title="Code Snippets"
        emptyDescription="Save reusable snippets of code. Add a language and a markdown body."
      />
    </Suspense>
  );
}