import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useInteraction } from "@/hooks/use-interaction";

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

function useProjectMutationInvalidation() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["projects"] });
    void qc.invalidateQueries({ queryKey: ["events"] });
  };
}

export function useAddProject() {
  const interaction = useInteraction();
  const invalidate = useProjectMutationInvalidation();
  return useMutation({
    mutationFn: (source: string) => interaction.addProject(source),
    onSuccess: () => invalidate(),
  });
}

export function useCreateProject() {
  const interaction = useInteraction();
  const invalidate = useProjectMutationInvalidation();
  return useMutation({
    mutationFn: (name: string) => interaction.createProject(name),
    onSuccess: () => invalidate(),
  });
}
