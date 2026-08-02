import { NoteDetail } from "@/components/note/NoteDetail";

export default async function SingleNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Keyed by id so client state resets when navigating between notes.
  return <NoteDetail key={id} noteId={id} />;
}
