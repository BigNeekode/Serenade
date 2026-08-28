import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

export function useEvents(limit = 50) {
  const api = useApi();
  return useQuery({
    queryKey: ["events", limit],
    queryFn: () => api.listEvents(limit),
    refetchInterval: 30_000,
  });
}
