import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

export function useAgents() {
  const api = useApi();
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => api.listAgents(),
    refetchInterval: 10_000,
  });
}
