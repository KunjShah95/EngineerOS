import { Suspense } from "react";

import { KnowledgeGraphPage } from "@/components/graph/KnowledgeGraphPage";
import { PageLoader } from "@/components/shell/PageLoader";

export default function GraphPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading knowledge graph…" />}>
      <KnowledgeGraphPage />
    </Suspense>
  );
}
