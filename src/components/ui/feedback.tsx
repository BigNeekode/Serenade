import type { ReactNode } from "react";
import clsx from "clsx";
import { AlertTriangle, Inbox } from "lucide-react";
import { isAppError, toAppError } from "@/types/domain";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-raised", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-6 py-12 text-center">
      <span className="text-fg-subtle">{icon ?? <Inbox size={20} />}</span>
      <p className="text-sm font-medium text-fg-muted">{title}</p>
      {description && <p className="max-w-sm text-xs text-fg-subtle leading-relaxed">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * Concrete failure UX (design.md §25): what failed, likely reason, next action.
 */
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const appErr = isAppError(error) ? error : toAppError(error);
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft/50 px-5 py-5">
      <div className="flex items-center gap-2 text-danger">
        <AlertTriangle size={15} />
        <p className="text-sm font-semibold">{appErr.title}</p>
      </div>
      <p className="text-xs leading-relaxed text-fg-muted">{appErr.message}</p>
      {appErr.detail && (
        <pre className="w-full overflow-x-auto rounded-md bg-black/30 p-2.5 font-mono text-[11px] text-fg-subtle whitespace-pre-wrap">
          {appErr.detail}
        </pre>
      )}
      {appErr.suggestedAction && (
        <p className="text-xs text-info">Suggested action: {appErr.suggestedAction}</p>
      )}
      {onRetry && appErr.recoverable && (
        <Button variant="secondary" size="xs" onClick={onRetry} className="mt-1">
          Retry
        </Button>
      )}
    </div>
  );
}
