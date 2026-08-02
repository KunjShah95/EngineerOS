import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { Note, VoiceNote } from "@/types/database";

const signedUrlCache = new Map<string, string>();

/** Create (and cache) a 1-hour signed URL for a voice note's audio file. */
export async function getVoiceNoteSignedUrl(storagePath: string): Promise<string | null> {
  const cached = signedUrlCache.get(storagePath);
  if (cached) return cached;
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("voice-notes")
    .createSignedUrl(storagePath, 3600);
  if (error || !data) return null;
  signedUrlCache.set(storagePath, data.signedUrl);
  return data.signedUrl;
}

export function voiceNotesKey(noteId: string | null) {
  return ["voice_notes", noteId ?? ""] as const;
}

/** All voice notes in the workspace, with the linked note title if any. */
export interface VoiceNoteWithNote extends VoiceNote {
  note: { id: string; title: string } | null;
}

export function allVoiceNotesKey(workspaceId: string | null) {
  return ["all_voice_notes", workspaceId ?? ""] as const;
}

export async function fetchAllVoiceNotes(workspaceId: string | null): Promise<VoiceNoteWithNote[]> {
  if (!workspaceId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("voice_notes")
    .select("*, note:notes(id, title)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VoiceNoteWithNote[];
}

export function useAllVoiceNotes(workspaceId: string | null) {
  return useQuery({
    queryKey: allVoiceNotesKey(workspaceId),
    queryFn: () => fetchAllVoiceNotes(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export async function fetchVoiceNotes(noteId: string | null): Promise<VoiceNote[]> {
  if (!noteId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("voice_notes")
    .select("*")
    .eq("note_id", noteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VoiceNote[];
}

export function useVoiceNotes(noteId: string | null) {
  return useQuery({
    queryKey: voiceNotesKey(noteId),
    queryFn: () => fetchVoiceNotes(noteId),
    enabled: Boolean(noteId),
  });
}

export interface CreateVoiceNoteInput {
  workspaceId: string;
  noteId: string | null;
  audio: Blob;
  durationMs: number;
}

export function useCreateVoiceNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, noteId, audio, durationMs }: CreateVoiceNoteInput) => {
      const supabase = createClient();

      const ext = audio.type.includes("ogg") ? "ogg" : "webm";
      const storagePath = `${workspaceId}/${crypto.randomUUID()}.${ext}`;
      const { error: upError } = await supabase.storage
        .from("voice-notes")
        .upload(storagePath, audio, { contentType: audio.type || "audio/webm" });
      if (upError) throw upError;

      const { data: voiceNote, error } = await supabase
        .from("voice_notes")
        .insert({
          workspace_id: workspaceId,
          note_id: noteId,
          storage_path: storagePath,
          duration_ms: durationMs,
          status: "recorded",
        })
        .select()
        .single();
      if (error) throw error;

      // Fire transcription in the background; status updates via a follow-up patch.
      const res = await fetch("/api/ai/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storage_path: storagePath }),
      });
      if (res.ok) {
        const json = (await res.json()) as { transcript?: string | null };
        await supabase
          .from("voice_notes")
          .update({
            transcript: json.transcript ?? null,
            status: json.transcript ? "transcribed" : "failed",
          })
          .eq("id", voiceNote.id);
      }
      return voiceNote;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: voiceNotesKey(vars.noteId) });
      queryClient.invalidateQueries({ queryKey: allVoiceNotesKey(vars.workspaceId) });
    },
  });
}

export function useDeleteVoiceNote(workspaceId: string | null, noteId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      const supabase = createClient();
      await supabase.storage.from("voice-notes").remove([storagePath]);
      const { error } = await supabase.from("voice_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: voiceNotesKey(noteId) });
      queryClient.invalidateQueries({ queryKey: allVoiceNotesKey(workspaceId) });
    },
  });
}

/** Link a standalone voice note to a freshly-created note (inbox triage).
 * Seeds the note body with the transcript so the note isn't blank, and rolls
 * the note back if the link step fails. */
export function useConvertVoiceNoteToNote(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ voiceNoteId }: { voiceNoteId: string }) => {
      const supabase = createClient();

      const { data: voiceNote } = await supabase
        .from("voice_notes")
        .select("transcript")
        .eq("id", voiceNoteId)
        .maybeSingle();
      const transcript = voiceNote?.transcript ?? "";

      const { data: note, error: noteError } = await supabase
        .from("notes")
        .insert({
          workspace_id: workspaceId,
          title: `Voice note · ${new Date().toLocaleDateString()}`,
          body_markdown: transcript,
        })
        .select()
        .single();
      if (noteError) throw noteError;

      try {
        const { error: linkError } = await supabase
          .from("voice_notes")
          .update({ note_id: note.id })
          .eq("id", voiceNoteId);
        if (linkError) throw linkError;
      } catch (err) {
        // Roll the orphan note back so a failed link leaves nothing behind.
        await supabase.from("notes").delete().eq("id", note.id).maybeSingle();
        throw err;
      }

      return note as Note;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: allVoiceNotesKey(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
