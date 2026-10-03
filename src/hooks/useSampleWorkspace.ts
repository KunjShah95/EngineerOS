"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  clearSampleWorkspace,
  hasSampleData,
  seedSampleWorkspace,
} from "@/lib/sample-workspace";

export function useHasSampleData(workspaceId: string | null) {
  return useQuery({
    queryKey: ["sample-data", workspaceId ?? ""],
    queryFn: () => hasSampleData(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useSeedSampleData(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("No workspace");
      await seedSampleWorkspace(workspaceId);
    },
    onSuccess: () => {
      toast.success("Sample workspace loaded");
      void queryClient.invalidateQueries();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Couldn't load sample data");
    },
  });
}

export function useClearSampleData(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("No workspace");
      await clearSampleWorkspace(workspaceId);
    },
    onSuccess: () => {
      toast.success("Sample data cleared");
      void queryClient.invalidateQueries();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Couldn't clear sample data");
    },
  });
}
