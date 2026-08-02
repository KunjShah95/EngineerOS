"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/shell/PageLoader";
import { EmptyState } from "@/components/shell/EmptyState";
import { MarkdownRenderer } from "@/components/note/MarkdownRenderer";
import { TagInput } from "@/components/note/TagInput";
import { useDeleteNote, useNote, useSetNoteTags, useUpdateNote } from "@/hooks/useNotes";
import { useProjects } from "@/hooks/useProjects";
import { useTags } from "@/hooks/useTags";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useSyncedState } from "@/lib/use-synced-state";
import { cn } from "@/lib/utils";
import { useAiSummary, useGenerateSummary } from "@/hooks/useAiSummary";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { VoiceNotesList } from "@/components/voice/VoiceNotesList";

type EditorMode = "edit" | "preview";

export function NoteDetail({ noteId }: { noteId: string }) {
  const router = useRouter();
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const { data: note, isLoading } = useNote(noteId);
  const { data: projects } = useProjects(workspaceId);
  const { data: tags } = useTags(workspaceId);
  const updateNote = useUpdateNote(noteId, workspaceId);
  const setNoteTags = useSetNoteTags(noteId, workspaceId);
  const deleteNote = useDeleteNote(noteId, workspaceId);

  const [mode, setMode] = useSyncedState<EditorMode>(
    note?.body_markdown ? "preview" : "edit"
  );
  const [title, setTitle] = useSyncedState(note?.title ?? "");
  const [body, setBody] = useSyncedState(note?.body_markdown ?? "");
  const [justSaved, setJustSaved] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  useEffect(() => {
    if (justSaved) {
      const t = setTimeout(() => setJustSaved(false), 1500);
      return () => clearTimeout(t);
    }
  }, [justSaved]);

  const saveTitle = useDebouncedCallback((value: string) => {
    updateNote.mutate({ title: value }, { onSuccess: () => setJustSaved(true) });
  }, 600);

  const saveBody = useDebouncedCallback((value: string) => {
    updateNote.mutate(
      { body_markdown: value },
      { onSuccess: () => setJustSaved(true), onError: () => toast.error("Failed to save note") }
    );
  }, 600);

  const { data: aiSummary } = useAiSummary(workspaceId, "note", noteId);
  const generateSummary = useGenerateSummary(workspaceId, "note", noteId);

  if (isLoading || !workspace) return <PageLoader label="Loading note…" />;

  if (!note) {
    return (
      <EmptyState
        icon={FileText}
        title="Note not found"
        description="It may have been deleted or the link is wrong."
      />
    );
  }

  const tagIds = (note.note_tags ?? []).map((nt) => nt.tag.id);
  const isSaving = updateNote.isPending;

  const handleDelete = async () => {
    await deleteNote.mutateAsync();
    toast.success("Note deleted");
    router.push("/notes");
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/notes"
          className="inline-flex items-center gap-1.5 text-sm text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          Notes
        </Link>

        <div className="flex items-center gap-1">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs text-faint">
            {isSaving || justSaved ? (
              <>
                {isSaving ? (
                  <Loader2 className="size-3 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Check className="size-3 text-success" strokeWidth={1.75} />
                )}
                {isSaving ? "Saving…" : "Saved"}
              </>
            ) : null}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
            aria-label={mode === "edit" ? "Preview rendered markdown" : "Edit markdown"}
          >
            {mode === "edit" ? (
              <Eye className="size-4" strokeWidth={1.75} />
            ) : (
              <Pencil className="size-4" strokeWidth={1.75} />
            )}
            {mode === "edit" ? "Preview" : "Edit"}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              updateNote.mutate({ pinned: !note.pinned }, { onSuccess: () => setJustSaved(true) })
            }
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            title={note.pinned ? "Unpin" : "Pin"}
            className={cn(note.pinned && "text-accent")}
          >
            {note.pinned ? (
              <Pin className="size-4" strokeWidth={1.75} />
            ) : (
              <PinOff className="size-4" strokeWidth={1.75} />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => void handleDelete()}
            aria-label="Delete note"
            className="text-danger hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      <Input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          saveTitle(e.target.value);
        }}
        onBlur={() =>
          updateNote.mutate({ title }, { onSuccess: () => setJustSaved(true) })
        }
        placeholder="Untitled"
        aria-label="Note title"
        className="mb-4 h-auto border-none bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 focus-visible:border-transparent placeholder:text-faint"
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border-subtle pb-4 text-xs text-faint">
        <Select
          value={note.project_id ?? "none"}
          onValueChange={(v) =>
            updateNote.mutate({ project_id: v === "none" ? null : v }, { onSuccess: () => setJustSaved(true) })
          }
        >
          <SelectTrigger size="sm" className="h-7 text-xs" aria-label="Project">
            <SelectValue placeholder="No project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No project</SelectItem>
            {(projects ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <TagInput
          workspaceId={workspace.id}
          tagIds={tagIds}
          allTags={tags ?? []}
          onChange={(nextIds) => setNoteTags.mutate(nextIds)}
        />

        <span className="ml-auto">
          Updated {new Date(note.updated_at).toLocaleString()}
        </span>
      </div>

      {/* AI summary + voice notes live under the editor */}
      <div className="mb-6 space-y-4">
        {(aiSummary || summaryExpanded) && (
          <div className="rounded-lg border border-border-subtle bg-surface p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-accent uppercase">
                <Sparkles className="size-3.5" strokeWidth={1.75} />
                AI summary
              </p>
              <span className="font-mono text-[10px] text-faint">
                {aiSummary?.model === "local-extractive" ? "local mode" : aiSummary?.model ?? ""}
              </span>
            </div>
            {generateSummary.isPending && !aiSummary ? (
              <p className="flex items-center gap-2 text-sm text-faint">
                <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                Summarizing…
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-secondary">
                {aiSummary?.summary ?? generateSummary.data?.summary ?? ""}
              </p>
            )}
            <button
              type="button"
              onClick={() => generateSummary.mutate()}
              disabled={generateSummary.isPending}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-hover disabled:opacity-50"
            >
              <RefreshCw className="size-3" strokeWidth={1.75} />
              {aiSummary ? "Regenerate" : "Generate"}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSummaryExpanded(true)}
            disabled={summaryExpanded || Boolean(aiSummary)}
          >
            <Sparkles className="size-3.5" strokeWidth={1.75} />
            Summarize with AI
          </Button>
          <VoiceRecorder workspaceId={workspace.id} noteId={noteId} compact />
        </div>

        <VoiceNotesList workspaceId={workspace.id} noteId={noteId} />
      </div>

      {mode === "edit" ? (
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            saveBody(e.target.value);
          }}
          onBlur={() =>
            updateNote.mutate(
              { body_markdown: body },
              { onSuccess: () => setJustSaved(true), onError: () => toast.error("Failed to save note") }
            )
          }
          placeholder="Write in markdown…"
          aria-label="Note body (markdown)"
          className="field-sizing-content min-h-[50vh] w-full resize-y rounded-lg border border-border-subtle bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground outline-none transition-colors duration-150 placeholder:text-faint focus:border-default focus:ring-2 focus:ring-ring/30"
        />
      ) : body.trim() ? (
        <div className="rounded-lg border border-border-subtle bg-surface px-6 py-4">
          <MarkdownRenderer content={body} />
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="Nothing written yet"
          description="Flip to edit mode and write your first markdown note."
        />
      )}
    </div>
  );
}
