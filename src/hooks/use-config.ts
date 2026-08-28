import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import type { AppConfig } from "@/types/domain";

export function useAppConfig() {
  const api = useApi();
  return useQuery({
    queryKey: ["config"],
    queryFn: () => api.getConfig(),
    refetchInterval: 120_000,
  });
}

export function useUpdateConfig() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AppConfig>) => api.updateConfig(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["config"] });
      void qc.invalidateQueries({ queryKey: ["environment"] });
      void qc.invalidateQueries({ queryKey: ["diagnostics"] });
    },
  });
}

export function useEnvironment() {
  const api = useApi();
  return useQuery({
    queryKey: ["environment"],
    queryFn: () => api.validateEnvironment(),
    refetchInterval: 120_000,
  });
}

export function useDiagnostics() {
  const api = useApi();
  return useQuery({
    queryKey: ["diagnostics"],
    queryFn: () => api.getDiagnostics(),
  });
}
