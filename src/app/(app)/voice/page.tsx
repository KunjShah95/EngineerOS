import { Suspense } from "react";

import { VoiceInboxPage } from "@/components/voice/VoiceInboxPage";
import { PageLoader } from "@/components/shell/PageLoader";

export default function VoiceInboxRoute() {
  return (
    <Suspense fallback={<PageLoader label="Loading voice inbox…" />}>
      <VoiceInboxPage />
    </Suspense>
  );
}
