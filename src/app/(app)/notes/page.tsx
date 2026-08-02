import { Suspense } from "react";

import { NotesList } from "@/components/note/NotesList";
import { PageLoader } from "@/components/shell/PageLoader";

export default function NotesPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading notes…" />}>
      <NotesList />
    </Suspense>
  );
}
