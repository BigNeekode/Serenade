import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import type { CreateTaskInput } from "@/types/domain";

export const taskKeys = {
  all: ["tasks"] as const,
  list: (projectId?: string) => ["tasks", projectId ?? "all"] as const,
  detail: (taskId: string) => ["task", taskId] as const,
};

export function useTasks(projectId?: string) {
  const api = useApi();
  return useQuery({
    queryKey: taskKeys.list(projectId),
    queryFn: () => api.listTasks(projectId),
    refetchInterval: 10_000,
  });
}

export function useTask(taskId: string) {
  const api = useApi();
  return useQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: () => api.getTask(taskId),
    enabled: !!taskId,
    refetchInterval: 5_000,
  });
}

function useTaskMutationInvalidation() {
  const qc = useQueryClient();
  return (taskId?: string) => {
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    void qc.invalidateQueries({ queryKey: ["agents"] });
    void qc.invalidateQueries({ queryKey: ["events"] });
    void qc.invalidateQueries({ queryKey: ["worktrees"] });
    void qc.invalidateQueries({ queryKey: ["reports"] });
    if (taskId) {
      void qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      void qc.invalidateQueries({ queryKey: ["logs", taskId] });
    }
  };
}

export function useCreateTask() {
  const api = useApi();
  const invalidate = useTaskMutationInvalidation();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.createTask(input),
    onSuccess: (task) => invalidate(task.id),
  });
}

export function useSendTaskMessage() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, message }: { taskId: string; message: string }) =>
      api.sendTaskMessage(taskId, message),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: taskKeys.detail(vars.taskId) });
      void qc.invalidateQueries({ queryKey: ["logs", vars.taskId] });
      void qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useRetryTask() {
  const api = useApi();
  const invalidate = useTaskMutationInvalidation();
  return useMutation({
    mutationFn: (taskId: string) => api.retryTask(taskId),
    onSuccess: (_data, taskId) => invalidate(taskId),
  });
}

export function useStopTask() {
  const api = useApi();
  const invalidate = useTaskMutationInvalidation();
  return useMutation({
    mutationFn: (taskId: string) => api.stopTask(taskId),
    onSuccess: (_data, taskId) => invalidate(taskId),
  });
}

export function usePromoteTask() {
  const api = useApi();
  const invalidate = useTaskMutationInvalidation();
  return useMutation({
    mutationFn: (taskId: string) => api.promoteTask(taskId),
    onSuccess: (task) => invalidate(task.id),
  });
}
