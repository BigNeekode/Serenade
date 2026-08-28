import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

export const projectKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["project", id] as const,
};

export function useProjects() {
  const api = useApi();
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: () => api.listProjects(),
    refetchInterval: 30_000,
  });
}

export function useProject(projectId: string) {
  const api = useApi();
  return useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => api.getProject(projectId),
    enabled: !!projectId,
  });
}
