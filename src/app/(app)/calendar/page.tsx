import { Suspense } from "react";

import { CalendarPage } from "@/components/calendar/CalendarPage";
import { PageLoader } from "@/components/shell/PageLoader";

export default function CalendarPageRoute() {
  return (
    <Suspense fallback={<PageLoader label="Loading calendar…" />}>
      <CalendarPage />
    </Suspense>
  );
}