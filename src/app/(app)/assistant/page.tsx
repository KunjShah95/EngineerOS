import { Suspense } from "react";

import { AssistantPage } from "@/components/assistant/AssistantPage";
import { PageLoader } from "@/components/shell/PageLoader";

export default function AssistantPageRoute() {
  return (
    <Suspense fallback={<PageLoader label="Loading assistant…" />}>
      <AssistantPage />
    </Suspense>
  );
}
