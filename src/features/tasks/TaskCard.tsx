import clsx from "clsx";
import type { Task } from "@/types/domain";
import { ClassBadge, Mono, Tag, TypeBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatRelativeTime } from "@/lib/format";

export function TaskCard({ task, onClick }: { task: Task; onClick?: () => void }) {
  const failed = task.status === "failed";
  return (
    <button
      onClick={onClick}
      data-testid={`task-card-${task.id}`}
      className={clsx(
        "w-full rounded-lg border bg-panel p-2.5 text-left transition-colors",
        failed ? "border-danger/40 hover:border-danger/60" : "border-line hover:border-line-strong",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Mono className="text-[10px] text-fg-subtle">{task.id}</Mono>
        <TypeBadge type={task.type} />
        <ClassBadge executionClass={task.executionClass} />
        {failed && <span className="ml-auto text-[10px] font-medium text-danger">attempt {task.attempts}</span>}
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-snug text-fg">{task.title}</p>
      {task.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      )}
      {task.progress != null && task.progress > 0 && task.progress < 100 && (
        <ProgressBar value={task.progress} className="mt-2" tone={failed ? "danger" : "accent"} />
      )}
      <p className="mt-2 text-[10px] text-fg-subtle">updated {formatRelativeTime(task.updatedAt)}</p>
    </button>
  );
}
