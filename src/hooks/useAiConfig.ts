import { useQuery } from "@tanstack/react-query";

interface AiConfigResponse {
  configured: boolean;
  provider: string | null;
  providerName: string | null;
  models: Record<string, string> | null;
  providers: Array<{
    name: string;
    configured: boolean;
    displayName: string;
    description: string;
  }>;
}

export function useAiConfig() {
  return useQuery({
    queryKey: ["ai_config"],
    queryFn: async () => {
      const res = await fetch("/api/ai/config");
      if (!res.ok) return { configured: false, provider: null, providerName: null, models: null, providers: [] } as AiConfigResponse;
      return (await res.json()) as AiConfigResponse;
    },
    staleTime: 60_000,
  });
}
