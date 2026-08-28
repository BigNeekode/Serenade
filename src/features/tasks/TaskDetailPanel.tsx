import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { ClassBadge, Mono, StatusBadge, Tag, TypeBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Skeleton, ErrorState } from "@/components/ui/feedback";
import { useTaskLookup, TaskChatTab } from "./TaskDetailPage";
import { TaskActionsMenu } from "./TaskActionsMenu";
import { useNow, isStaleHeartbeat } from "@/hooks/use-now";
import { formatCost, formatDuration, formatRelativeTime, formatTokens } from "@/lib/format";

export function TaskDetailPanel({ taskId }: { taskId: string }) {
  const { task, agent, worktree } = useTaskLookup(taskId);
  const now = useNow();

  if (task.isError) return <div className="p-4"><ErrorState error={task.error} /></div>;
  if (task.isLoading || !task.data) return <div className="space-y-3 p-4"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-20" /></div>;

  const t = task.data;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold leading-snug text-fg">{t.title}</h2>
          <TaskActionsMenu task={t} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Mono className="text-[10px]">{t.id}</Mono>
          <TypeBadge type={t.type} />
          <ClassBadge executionClass={t.executionClass} />
          <StatusBadge status={t.status} />
        </div>
        {t.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {t.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        )}
        {(t.progress ?? 0) > 0 && (
          <div className="flex items-center gap-2">
            <ProgressBar value={t.progress} tone={t.status === "failed" ? "danger" : "accent"} />
            <span className="shrink-0 text-[10px] tabular-nums text-fg-subtle">{t.progress}%</span>
          </div>
        )}
        {t.description && (
          <p className="line-clamp-4 text-xs leading-relaxed text-fg-muted">{t.description}</p>
        )}
      </div>

      {agent && (
        <div className="rounded-lg border border-line bg-panel p-3 text-xs">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Worker</p>
          <div className="grid gap-y-1.5">
            <div className="flex justify-between gap-3">
              <span className="text-fg-subtle">agent</span>
              <Link to="/agents" className="font-mono text-accent hover:underline">{agent.id}</Link>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-fg-subtle">provider</span>
              <span className="text-fg-muted">{agent.provider}/{agent.model}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-fg-subtle">status</span>
              <StatusBadge status={agent.status} kind="agent" />
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-fg-subtle">runtime</span>
              <span className="text-fg-muted">{formatDuration(agent.startedAt, agent.endedAt)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-fg-subtle">heartbeat</span>
              <span className={isStaleHeartbeat(agent.heartbeatAt, agent.status, now) ? "text-warning" : "text-fg-muted"}>
                {formatRelativeTime(agent.heartbeatAt)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-fg-subtle">tokens / cost</span>
              <span className="tabular-nums text-fg-muted">{formatTokens(agent.tokenUsage)} / {formatCost(agent.costEstimate)}</span>
            </div>
          </div>
        </div>
      )}

      {worktree && (
        <div className="rounded-lg border border-line bg-panel p-3 text-xs">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Worktree</p>
          <p className="truncate font-mono text-[11px] text-accent">{worktree.branch}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-fg-subtle">{worktree.path}</p>
          <p className="mt-1 text-fg-subtle">
            {worktree.gitStatus} · {worktree.changedFiles ?? 0} changed · {worktree.aheadBehind?.[0] ?? 0}↑ {worktree.aheadBehind?.[1] ?? 0}↓
          </p>
        </div>
      )}

      <Link
        to={`/tasks/${t.id}`}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-line bg-panel py-2 text-xs text-fg-muted hover:border-line-strong hover:text-fg"
      >
        <ArrowUpRight size={12} />
        Open full task page
      </Link>

      <TaskChatTab taskId={taskId} compact />
    </div>
  );
}
