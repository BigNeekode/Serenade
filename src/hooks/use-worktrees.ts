import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

export function useWorktrees(projectId?: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["worktrees", projectId ?? "all"],
    queryFn: () => api.listWorktrees(projectId),
    refetchInterval: 20_000,
  });
}

export function useCleanupWorktree() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (worktreeId: string) => api.cleanupWorktree(worktreeId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["worktrees"] });
      void qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useOpenWorktree() {
  const api = useApi();
  return useMutation({
    mutationFn: ({ worktreeId, target }: { worktreeId: string; target: "editor" | "folder" | "terminal" }) =>
      api.openWorktree(worktreeId, target),
  });
}
