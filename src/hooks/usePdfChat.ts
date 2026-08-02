import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import type { PdfDocument } from "@/types/database";
import {
  PROJECT_FILTER_ALL,
  PROJECT_FILTER_UNFILED,
  type ProjectFilterValue,
} from "@/components/shell/ProjectFilter";

export function pdfDocsKey(workspaceId: string | null, projectFilter: ProjectFilterValue) {
  return ["pdf_documents", workspaceId ?? "", projectFilter] as const;
}

export async function fetchPdfDocuments(
  workspaceId: string | null,
  projectFilter: ProjectFilterValue
): Promise<PdfDocument[]> {
  if (!workspaceId) return [];
  const supabase = createClient();

  let query = supabase
    .from("pdf_documents")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (projectFilter === PROJECT_FILTER_UNFILED) {
    query = query.is("project_id", null);
  } else if (projectFilter !== PROJECT_FILTER_ALL) {
    query = query.eq("project_id", projectFilter);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PdfDocument[];
}

export function usePdfDocuments(workspaceId: string | null, projectFilter: ProjectFilterValue) {
  return useQuery({
    queryKey: pdfDocsKey(workspaceId, projectFilter),
    queryFn: () => fetchPdfDocuments(workspaceId, projectFilter),
    enabled: Boolean(workspaceId),
  });
}

export function useUploadPdf(workspaceId: string | null, projectFilter: ProjectFilterValue) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      // When a specific project is selected, new uploads are filed into it.
      // "All projects" and "Unfiled" leave the document unassigned.
      if (projectFilter !== PROJECT_FILTER_ALL && projectFilter !== PROJECT_FILTER_UNFILED) {
        form.append("project_id", projectFilter);
      }
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
      queryClient.invalidateQueries({ queryKey: ["pdf_documents"] });
    },
  });
}

export function useDeletePdf() {
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
      // Prefix-wide: a deleted doc may be cached under sibling filter keys too.
      queryClient.invalidateQueries({ queryKey: ["pdf_documents"] });
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
