import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Skeleton } from "./feedback";
import { EmptyState } from "./feedback";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getKey,
  onRowClick,
  loading = false,
  error,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  initialSortKey,
}: {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  error?: unknown;
  emptyTitle?: string;
  emptyDescription?: string;
  initialSortKey?: string;
}) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortValue) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = [...rows];
  if (sortKey) {
    const col = columns.find((c) => c.key === sortKey);
    if (col?.sortValue) {
      sorted.sort((a, b) => {
        const av = col.sortValue!(a);
        const bv = col.sortValue!(b);
        const cmp = typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-line text-fg-subtle">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className={clsx(
                  "px-3 py-2.5 font-medium whitespace-nowrap",
                  col.sortValue && "cursor-pointer hover:text-fg-muted select-none",
                  col.headerClassName,
                )}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortValue &&
                    (sortKey === col.key ? (
                      sortDir === "asc" ? (
                        <ArrowUp size={11} />
                      ) : (
                        <ArrowDown size={11} />
                      )
                    ) : (
                      <ArrowUpDown size={11} className="opacity-30" />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-line/60">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2.5">
                    <Skeleton className="h-3.5 w-full max-w-32" />
                  </td>
                ))}
              </tr>
            ))}
          {!loading &&
            sorted.map((row) => (
              <tr
                key={getKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(
                  "border-b border-line/60 last:border-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-hover/60",
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={clsx("px-3 py-2.5 align-middle", col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
      {!loading && !error && sorted.length === 0 && (
        <div className="p-4">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      )}
      {error ? (
        <div className="p-4">
          <EmptyState title="Failed to load data" description={String(error)} />
        </div>
      ) : null}
    </div>
  );
}
