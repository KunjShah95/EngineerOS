import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { PdfDocument } from "@/types/database";

export function pdfDocsKey(workspaceId: string | null) {
  return ["pdf_documents", workspaceId ?? ""] as const;
}

export async function fetchPdfDocuments(workspaceId: string | null): Promise<PdfDocument[]> {
  if (!workspaceId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pdf_documents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PdfDocument[];
}

export function usePdfDocuments(workspaceId: string | null) {
  return useQuery({
    queryKey: pdfDocsKey(workspaceId),
    queryFn: () => fetchPdfDocuments(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useUploadPdf(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/pdf/ingest", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
        document?: PdfDocument;
      } | null;
      if (!res.ok || !json?.document) {
        throw new Error(json?.error ?? "Upload failed");
      }
      return json.document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pdfDocsKey(workspaceId) });
    },
  });
}

export function useDeletePdf(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string | null }) => {
      const supabase = createClient();
      if (storagePath) {
        await supabase.storage.from("pdfs").remove([storagePath]);
      }
      const { error } = await supabase.from("pdf_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pdfDocsKey(workspaceId) });
    },
  });
}

export interface ChatAnswer {
  answer: string;
  model: string;
  local: boolean;
  sources: string[];
}

export function usePdfChat(documentId: string | null) {
  return useMutation({
    mutationFn: async (question: string) => {
      const res = await fetch("/api/ai/pdf-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: documentId, question }),
      });
      const json = (await res.json().catch(() => null)) as (ChatAnswer & { error?: string }) | null;
      if (!res.ok || !json) throw new Error(json?.error ?? "Chat failed");
      return json as ChatAnswer;
    },
  });
}
