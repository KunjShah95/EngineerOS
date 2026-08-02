import { Suspense } from "react";
import { Users } from "lucide-react";

import { ResourceList } from "@/components/resource/ResourceList";
import { PageLoader } from "@/components/shell/PageLoader";

export default function MeetingsPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading…" />}>
      <ResourceList
        kind="meeting"
        icon={Users}
        title="Meetings"
        emptyDescription="Record meeting notes with dates and attendees."
      />
    </Suspense>
  );
}