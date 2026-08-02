import { Suspense } from "react";
import { Bookmark } from "lucide-react";

import { ResourceList } from "@/components/resource/ResourceList";
import { PageLoader } from "@/components/shell/PageLoader";

export default function BookmarksPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading…" />}>
      <ResourceList
        kind="bookmark"
        icon={Bookmark}
        title="Bookmarks"
        emptyDescription="Save links you want to revisit. Add a URL and context."
      />
    </Suspense>
  );
}