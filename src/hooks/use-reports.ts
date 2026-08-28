import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

export function useReports(projectId?: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["reports", projectId ?? "all"],
    queryFn: () => api.listReports(projectId),
    refetchInterval: 60_000,
  });
}

export function useReport(reportId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["report", reportId],
    queryFn: () => api.getReport(reportId),
    enabled: !!reportId,
  });
}
