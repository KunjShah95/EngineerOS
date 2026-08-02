import { Suspense } from "react";

import { AutomationPage } from "@/components/automation/AutomationPage";
import { PageLoader } from "@/components/shell/PageLoader";

export default function AutomationRoute() {
  return (
    <Suspense fallback={<PageLoader label="Loading automation…" />}>
      <AutomationPage />
    </Suspense>
  );
}
