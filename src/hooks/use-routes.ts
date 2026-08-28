import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

export function useRoutes() {
  const api = useApi();
  return useQuery({
    queryKey: ["routes"],
    queryFn: () => api.listRoutes(),
    refetchInterval: 60_000,
  });
}
