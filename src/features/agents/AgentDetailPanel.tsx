import { Link } from "react-router-dom";
import { Bot, HeartPulse } from "lucide-react";
import { Mono, ProviderBadge, StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Skeleton } from "@/components/ui/feedback";
import { useAgents } from "@/hooks/use-agents";
import { useTasks } from "@/hooks/use-tasks";
import { useEvents } from "@/hooks/use-events";
import { useNow, isStaleHeartbeat } from "@/hooks/use-now";
import { formatCost, formatDuration, formatRelativeTime, formatTimestamp, formatTokens } from "@/lib/format";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-fg-subtle">{label}</span>
      <span className="min-w-0 truncate text-right text-fg-muted">{value}</span>
    </div>
  );
}

export function AgentDetailPanel({ agentId }: { agentId: string }) {
  const { data: agents, isLoading } = useAgents();
  const { data: tasks } = useTasks();
  const events = useEvents(50);
  const now = useNow();
  const agent = agents?.find((a) => a.id === agentId);

  if (isLoading) return <div className="space-y-3 p-4"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-24" /></div>;
  if (!agent) return <p className="p-4 text-xs text-fg-subtle">Agent {agentId} is no longer active.</p>;

  const task = tasks?.find((t) => t.id === agent.taskId);
  const agentEvents = (events.data ?? []).filter((e) => e.agentId === agent.id).slice(0, 12);
  const stale = isStaleHeartbeat(agent.heartbeatAt, agent.status, now);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-fg-subtle" />
          <Mono className="text-fg">{agent.id}</Mono>
          <StatusBadge status={agent.status} kind="agent" />
        </div>
        <div className="flex items-center gap-2">
          <ProviderBadge provider={agent.provider} />
          <Mono>{agent.model}</Mono>
        </div>
        {stale && (
          <div className="flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-[11px] text-warning">
            <HeartPulse size={12} />
            heartbeat stale since {formatRelativeTime(agent.heartbeatAt)}
          </div>
        )}
        {agent.progress != null && (
          <div className="flex items-center gap-2">
            <ProgressBar value={agent.progress} />
            <span className="shrink-0 text-[10px] tabular-nums text-fg-subtle">{agent.progress}%</span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-line bg-panel p-3">
        <div className="grid gap-y-1.5">
          <Row label="task" value={task ? (
            <Link to={`/tasks/${task.id}`} className="text-accent hover:underline">{task.id}</Link>
          ) : "—"} />
          {task && <Row label="title" value={task.title} />}
          <Row label="branch" value={<Mono>{agent.branch ?? "—"}</Mono>} />
          <Row label="runtime" value={formatDuration(agent.startedAt, agent.endedAt)} />
          <Row label="started" value={formatRelativeTime(agent.startedAt)} />
          <Row label="heartbeat" value={formatRelativeTime(agent.heartbeatAt)} />
          <Row label="ended" value={agent.endedAt ? formatRelativeTime(agent.endedAt) : "—"} />
          <Row label="tokens" value={formatTokens(agent.tokenUsage)} />
          <Row label="cost" value={formatCost(agent.costEstimate)} />
          <Row label="log path" value={<Mono>{agent.logPath ?? "—"}</Mono>} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Recent events</p>
        <div className="space-y-1">
          {agentEvents.length === 0 && <p className="text-xs text-fg-subtle">no recent events</p>}
          {agentEvents.map((event) => (
            <div key={event.id} className="flex items-baseline gap-2 rounded px-1.5 py-1 hover:bg-hover/50">
              <span className="shrink-0 font-mono text-[10px] text-fg-subtle">{formatTimestamp(event.createdAt)}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{event.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
