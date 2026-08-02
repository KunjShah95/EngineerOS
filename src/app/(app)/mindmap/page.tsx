import { Suspense } from "react";

import { MindMapPage } from "@/components/mindmap/MindMapPage";
import { PageLoader } from "@/components/shell/PageLoader";

export default function MindMapRoute() {
  return (
    <Suspense fallback={<PageLoader label="Loading mind map…" />}>
      <MindMapPage />
    </Suspense>
  );
}
