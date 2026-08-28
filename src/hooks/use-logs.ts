import { useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

/**
 * Incremental log chunks with a cursor (architecture.md §16).
 * Polling keeps the tail fresh while the user is watching.
 */
export function useTaskLogs(taskId: string, options?: { paused?: boolean; poll?: boolean }) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: ["logs", taskId],
    queryFn: ({ pageParam }) =>
      api.readTaskLogs({ taskId, cursor: pageParam || undefined, limit: 100 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!taskId,
    refetchInterval: options?.paused || options?.poll === false ? false : 3_000,
  });
}
