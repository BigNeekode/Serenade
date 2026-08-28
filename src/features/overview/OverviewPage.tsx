import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  FolderGit2,
  KanbanSquare,
  Timer,
  XCircle,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { PageContainer } from "@/components/layout/AppShell";
import { LastUpdated } from "@/components/common/LastUpdated";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { useAgents } from "@/hooks/use-agents";
import { useEvents } from "@/hooks/use-events";
import { useReports } from "@/hooks/use-reports";
import { useNow, isStaleHeartbeat } from "@/hooks/use-now";
import { formatPercent, formatRelativeTime } from "@/lib/format";

const severityIcon = {
  info: <Activity size={12} className="text-info" />,
  success: <CheckCircle2 size={12} className="text-success" />,
  warning: <AlertTriangle size={12} className="text-warning" />,
  error: <XCircle size={12} className="text-danger" />,
};

export function OverviewPage() {
  const projects = useProjects();
  const tasks = useTasks();
  const agents = useAgents();
  const events = useEvents(20);
  const reports = useReports();
  const now = useNow();

  const taskList = tasks.data ?? [];
  const agentList = agents.data ?? [];
  const activeProjects = projects.data?.filter((p) => p.status === "active") ?? [];
  const activeAgents = agentList.filter((a) => ["running", "waiting", "starting"].includes(a.status));
  const runningTasks = taskList.filter((t) => ["in_progress", "scouting"].includes(t.status));
  const failedTasks = taskList.filter((t) => t.status === "failed");
  const doneTasks = taskList.filter((t) => t.status === "done");
  const reviewTasks = taskList.filter((t) => t.status === "review" || t.status === "ready");
  const successRate = doneTasks.length + failedTasks.length > 0
    ? (doneTasks.length / (doneTasks.length + failedTasks.length)) * 100
    : null;
  const staleAgents = agentList.filter((a) => isStaleHeartbeat(a.heartbeatAt, a.status, now));
  const failureReports = (reports.data ?? []).filter((r) => r.kind === "failure_summary");

  const projectName = (id?: string) => projects.data?.find((p) => p.id === id)?.name ?? id ?? "—";

  return (
    <PageContainer
      title="Fleet Overview"
      subtitle="Cross-project operational summary"
      actions={<LastUpdated query={tasks} />}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Active Projects" value={activeProjects.length} icon={<FolderGit2 size={13} />} />
        <StatCard label="Active Agents" value={activeAgents.length} icon={<Bot size={13} />} tone={activeAgents.length > 4 ? "warning" : "neutral"} />
        <StatCard label="Running Tasks" value={runningTasks.length} icon={<KanbanSquare size={13} />} />
        <StatCard label="Failed Tasks" value={failedTasks.length} tone={failedTasks.length > 0 ? "danger" : "success"} icon={<XCircle size={13} />} />
        <StatCard label="Success Rate" value={successRate == null ? "—" : formatPercent(successRate)} tone="accent" icon={<Zap size={13} />} />
        <StatCard label="Pending Review" value={reviewTasks.length} tone="warning" icon={<Timer size={13} />} />
      </div>

      {staleAgents.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3">
          <AlertTriangle size={14} className="mt-0.5 text-warning" />
          <div className="text-xs leading-relaxed">
            <p className="font-medium text-warning">Stale worker heartbeats</p>
            {staleAgents.map((a) => (
              <p key={a.id} className="text-fg-muted">
                <Link to="/agents" className="font-mono text-accent hover:underline">
                  {a.id}
                </Link>{" "}
                — last heartbeat {formatRelativeTime(a.heartbeatAt)}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent Activity" action={<LastUpdated query={events} />} />
          <div className="max-h-96 overflow-y-auto p-2">
            {events.isLoading && (
              <div className="space-y-2 p-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            )}
            {events.isError && <div className="p-2"><ErrorState error={events.error} onRetry={() => void events.refetch()} /></div>}
            {events.data?.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-hover/50"
              >
                <span className="mt-0.5">{severityIcon[event.severity]}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-fg-muted">{event.message}</p>
                  <p className="mt-0.5 text-[10px] text-fg-subtle">
                    {event.taskId ? (
                      <Link to={`/tasks/${event.taskId}`} className="font-mono text-accent/80 hover:underline">
                        {event.taskId}
                      </Link>
                    ) : (
                      <span>{projectName(event.projectId)}</span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] text-fg-subtle">
                  {formatRelativeTime(event.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Project Health" />
            <div className="space-y-1 p-2">
              {projects.data?.map((project) => {
                const pt = taskList.filter((t) => t.projectId === project.id);
                const running = pt.filter((t) => ["in_progress", "scouting"].includes(t.status)).length;
                const blocked = pt.filter((t) => ["blocked", "stopped"].includes(t.status)).length;
                const failed = pt.filter((t) => t.status === "failed").length;
                const review = pt.filter((t) => ["review", "ready"].includes(t.status)).length;
                return (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-hover/50"
                  >
                    <span
                      className={clsx(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        project.status === "active" ? "bg-success" : "bg-warning",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-fg">{project.name}</span>
                    <span className="flex items-center gap-1.5 text-[10px] tabular-nums">
                      <span className="text-success">{running} run</span>
                      <span className="text-warning">{blocked + review} wait</span>
                      <span className={failed > 0 ? "text-danger" : "text-fg-subtle"}>{failed} fail</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="Provider Usage" />
            <div className="space-y-2 p-3">
              {agents.isLoading ? (
                <Skeleton className="h-20" />
              ) : (
                <>
                  {Object.entries(
                    agentList.reduce<Record<string, { workers: number; done: number }>>((acc, a) => {
                      acc[a.provider] ??= { workers: 0, done: 0 };
                      if (["running", "waiting", "starting"].includes(a.status)) acc[a.provider].workers += 1;
                      if (a.status === "completed") acc[a.provider].done += 1;
                      return acc;
                    }, {}),
                  ).map(([provider, usage]) => (
                    <div key={provider} className="flex items-center justify-between text-xs">
                      <Badge tone="neutral">{provider}</Badge>
                      <span className="text-fg-muted tabular-nums">
                        {usage.workers} workers · {usage.done} completed
                      </span>
                    </div>
                  ))}
                  <p className="pt-1 text-[10px] text-fg-subtle">token/cost totals appear in the status bar</p>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Recent Failures" />
        <div className="space-y-1 p-2">
          {failedTasks.length === 0 && failureReports.length === 0 && (
            <EmptyState
              title="No failures"
              description="Nothing requires attention right now."
              icon={<CheckCircle2 size={18} className="text-success" />}
            />
          )}
          {failedTasks.map((task) => (
            <Link
              key={task.id}
              to={`/tasks/${task.id}`}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-hover/50"
            >
              <StatusBadge status={task.status} />
              <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{task.title}</span>
              <span className="text-[10px] text-fg-subtle">{projectName(task.projectId)}</span>
              <span className="text-[10px] text-fg-subtle">{formatRelativeTime(task.updatedAt)}</span>
            </Link>
          ))}
          {failureReports.map((report) => (
            <Link
              key={report.id}
              to={`/reports/${report.id}`}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-hover/50"
            >
              <Badge tone="danger">failure summary</Badge>
              <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{report.title}</span>
              <span className="text-[10px] text-fg-subtle">{projectName(report.projectId)}</span>
            </Link>
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}
