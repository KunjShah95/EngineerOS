import { useQuery } from "@tanstack/react-query";

export function useAiConfig() {
  return useQuery({
    queryKey: ["ai_config"],
    queryFn: async () => {
      const res = await fetch("/api/ai/config");
      if (!res.ok) return { configured: false };
      return (await res.json()) as { configured: boolean };
    },
    staleTime: 60_000,
  });
}
