"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileAudio, FileText, Loader2, Mic, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell/EmptyState";
import { PageLoader } from "@/components/shell/PageLoader";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import {
  getVoiceNoteSignedUrl,
  useAllVoiceNotes,
  useConvertVoiceNoteToNote,
  useDeleteVoiceNote,
} from "@/hooks/useVoiceNotes";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

type Filter = "all" | "unfiled" | "in-notes";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unfiled", label: "Unfiled" },
  { value: "in-notes", label: "In notes" },
];

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function VoiceInboxPage() {
  const router = useRouter();
  const { data: workspace, isLoading } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const { data: voiceNotes, isLoading: notesLoading } = useAllVoiceNotes(workspaceId);
  const deleteVoiceNote = useDeleteVoiceNote(workspaceId, null);
  const convertToNote = useConvertVoiceNoteToNote(workspaceId);

  const [filter, setFilter] = useState<Filter>("all");
  const [recordOpen, setRecordOpen] = useState(false);

  const getUrl = getVoiceNoteSignedUrl;

  const filtered = useMemo(() => {
    const all = voiceNotes ?? [];
    if (filter === "unfiled") return all.filter((vn) => !vn.note_id);
    if (filter === "in-notes") return all.filter((vn) => vn.note_id);
    return all;
  }, [voiceNotes, filter]);

  const unfiledCount = (voiceNotes ?? []).filter((vn) => !vn.note_id).length;

  if (isLoading || !workspace) return <PageLoader label="Loading voice inbox…" />;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Voice inbox</h1>
          <p className="text-sm text-faint">
            {voiceNotes?.length ?? 0} recordings
            {unfiledCount > 0 ? ` · ${unfiledCount} unfiled` : ""}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setRecordOpen((v) => !v)}>
          <Mic className="size-4" strokeWidth={1.75} />
          {recordOpen ? "Hide recorder" : "Record"}
        </Button>
      </div>

      {recordOpen && (
        <div className="mb-5 rounded-lg border border-border-subtle bg-surface p-4">
          <p className="mb-3 text-xs font-medium text-secondary">
            Record a standalone voice note — it lands in the inbox, ready to file.
          </p>
          <VoiceRecorder
            workspaceId={workspace.id}
            compact
            onSaved={() => setRecordOpen(false)}
          />
        </div>
      )}

      <div className="mb-4 flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-foreground",
              filter === f.value && "bg-surface-hover text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {notesLoading ? (
        <p className="flex items-center gap-2 text-sm text-faint">
          <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
          Loading recordings…
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileAudio}
          title={
            (voiceNotes ?? []).length === 0
              ? "No voice notes yet"
              : "Nothing here"
          }
          description={
            (voiceNotes ?? []).length === 0
              ? "Hit Record and speak — your note is captured in one tap."
              : "Try a different filter."
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((vn) => (
            <li key={vn.id} className="rounded-lg border border-border-subtle bg-surface p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
                  <FileAudio className="size-4" strokeWidth={1.75} />
                </span>
                <audio
                  controls
                  preload="metadata"
                  src={undefined}
                  className="h-8 min-w-0 flex-1"
                  ref={(el) => {
                    if (el && !el.dataset.loaded) {
                      el.dataset.loaded = "1";
                      void getUrl(vn.storage_path).then((url) => {
                        if (url) el.src = url;
                      });
                    }
                  }}
                />
                <span className="shrink-0 font-mono text-xs text-faint tabular-nums">
                  {formatDuration(vn.duration_ms)}
                </span>
                <button
                  type="button"
                  onClick={() => void deleteVoiceNote.mutateAsync({ id: vn.id, storagePath: vn.storage_path })}
                  className="shrink-0 rounded p-1.5 text-faint transition-colors hover:text-danger"
                  aria-label="Delete voice note"
                >
                  <Trash2 className="size-4" strokeWidth={1.75} />
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-faint">
                <span>{new Date(vn.created_at).toLocaleString()}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase",
                    vn.status === "transcribed"
                      ? "bg-success/10 text-success"
                      : vn.status === "failed"
                        ? "bg-danger/10 text-danger"
                        : "bg-surface-hover text-faint"
                  )}
                >
                  {vn.status}
                </span>
                {vn.note ? (
                  <Link
                    href={`/notes/${vn.note.id}`}
                    className="inline-flex items-center gap-1 text-accent transition-colors hover:text-accent-hover"
                  >
                    <FileText className="size-3" strokeWidth={1.75} />
                    {vn.note.title}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      void convertToNote
                        .mutateAsync({ voiceNoteId: vn.id })
                        .then((note) => {
                          toast.success("Converted to a note");
                          router.push(`/notes/${note.id}`);
                        })
                        .catch(() => toast.error("Failed to convert"))
                    }
                    disabled={convertToNote.isPending}
                    className="inline-flex items-center gap-1 text-accent transition-colors hover:text-accent-hover disabled:opacity-50"
                  >
                    <FileText className="size-3" strokeWidth={1.75} />
                    Turn into note
                  </button>
                )}
              </div>

              {vn.transcript && (
                <p className="mt-2 border-t border-border-subtle pt-2 text-sm leading-relaxed text-secondary">
                  {vn.transcript}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
