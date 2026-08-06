import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { NoteAttachment } from "@/types/database";

export function noteAttachmentsKey(noteId: string | null) {
  return ["note_attachments", noteId ?? ""] as const;
}

export async function fetchNoteAttachments(noteId: string): Promise<NoteAttachment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("note_attachments")
    .select("*")
    .eq("note_id", noteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as NoteAttachment[];
}

export function useNoteAttachments(noteId: string | null) {
  return useQuery({
    queryKey: noteAttachmentsKey(noteId),
    queryFn: () => fetchNoteAttachments(noteId!),
    enabled: Boolean(noteId),
  });
}

/** Generate a short-lived signed URL so the private object can be opened/downloaded. */
export async function getAttachmentUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function useUploadNoteAttachment(noteId: string | null, workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<NoteAttachment> => {
      if (!noteId || !workspaceId) throw new Error("Missing note context");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const safeName = file.name.replace(/[^\w.\- ]/g, "_");
      const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: upError } = await supabase.storage
        .from("attachments")
        .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });
      if (upError) throw upError;

      const { data, error } = await supabase
        .from("note_attachments")
        .insert({
          note_id: noteId,
          workspace_id: workspaceId,
          name: file.name,
          storage_path: storagePath,
          mime_type: file.type || null,
          size_bytes: file.size,
        })
        .select()
        .single();
      if (error) {
        // Best-effort cleanup of the orphaned object.
        await supabase.storage.from("attachments").remove([storagePath]);
        throw error;
      }
      return data as NoteAttachment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteAttachmentsKey(noteId) });
    },
  });
}

export function useDeleteNoteAttachment(noteId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      const supabase = createClient();
      await supabase.storage.from("attachments").remove([storagePath]);
      const { error } = await supabase.from("note_attachments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteAttachmentsKey(noteId) });
    },
  });
}
