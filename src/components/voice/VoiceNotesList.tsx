"use client";

import { FileAudio, Loader2, Trash2 } from "lucide-react";

import {
  getVoiceNoteSignedUrl,
  useDeleteVoiceNote,
  useVoiceNotes,
} from "@/hooks/useVoiceNotes";
import { cn } from "@/lib/utils";

export function VoiceNotesList({ workspaceId, noteId }: { workspaceId: string; noteId: string }) {
  const { data: voiceNotes, isLoading } = useVoiceNotes(noteId);
  const deleteVoiceNote = useDeleteVoiceNote(workspaceId, noteId);

  const getUrl = getVoiceNoteSignedUrl;

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-faint">
        <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
        Loading voice notes…
      </p>
    );
  }

  if (!voiceNotes || voiceNotes.length === 0) return null;

  return (
    <div className="space-y-2">
      {voiceNotes.map((vn) => (
        <div key={vn.id} className="rounded-lg border border-border-subtle bg-surface p-3">
          <div className="flex items-center gap-3">
            <FileAudio className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
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
            <span
              className={cn(
                "shrink-0 font-mono text-[10px] uppercase",
                vn.status === "transcribed"
                  ? "text-success"
                  : vn.status === "failed"
                    ? "text-danger"
                    : "text-faint"
              )}
            >
              {vn.status === "transcribed" ? "transcribed" : vn.status === "failed" ? "failed" : "recorded"}
            </span>
            <button
              type="button"
              onClick={() => void deleteVoiceNote.mutateAsync({ id: vn.id, storagePath: vn.storage_path })}
              className="shrink-0 rounded p-1 text-faint transition-colors hover:text-danger"
              aria-label="Delete voice note"
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
          {vn.transcript ? (
            <p className="mt-2 text-sm leading-relaxed text-secondary">{vn.transcript}</p>
          ) : (
            <p className="mt-2 text-xs text-faint">
              {vn.status === "failed"
                ? "Transcription failed."
                : "Transcription pending — set OPENAI_API_KEY to enable Whisper."}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
