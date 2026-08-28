import type { UseQueryResult } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";

export function LastUpdated({ query }: { query: UseQueryResult }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
      {query.isFetching ? (
        <span className="flex items-center gap-1">
          <RefreshCw size={11} className="animate-spin" />
          refreshing…
        </span>
      ) : query.dataUpdatedAt ? (
        <span>updated {formatRelativeTime(new Date(query.dataUpdatedAt).toISOString())}</span>
      ) : (
        <span>never updated</span>
      )}
      <button
        onClick={() => void query.refetch()}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-raised hover:text-fg-muted"
        aria-label="Refresh now"
      >
        <RefreshCw size={11} />
        refresh
      </button>
    </div>
  );
}
