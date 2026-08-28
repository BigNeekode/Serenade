import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Settings } from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { LastUpdated } from "@/components/common/LastUpdated";
import { StatCard } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SearchInput, Select } from "@/components/ui/input";
import { Badge, Mono, StatusBadge, TypeBadge } from "@/components/ui/badge";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { useProject } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { useAgents } from "@/hooks/use-agents";
import { useEvents } from "@/hooks/use-events";
import { TaskCard } from "@/features/tasks/TaskCard";
import { TaskCreateDialog } from "@/features/tasks/TaskCreateDialog";
import { useUiStore } from "@/state/ui-store";
import { formatPercent, formatRelativeTime } from "@/lib/format";
import type { Task, TaskStatus } from "@/types/domain";

const COLUMNS: { id: string; title: string; statuses: TaskStatus[] }[] = [
  { id: "backlog", title: "Backlog", statuses: ["backlog", "queued"] },
  { id: "scouting", title: "Scouting", statuses: ["scouting"] },
  { id: "ready", title: "Ready to Ship", statuses: ["ready"] },
  { id: "in_progress", title: "In Progress", statuses: ["in_progress"] },
  { id: "review", title: "Review", statuses: ["review"] },
  { id: "done", title: "Done", statuses: ["done"] },
  { id: "blocked", title: "Blocked", statuses: ["blocked", "failed", "stopped"] },
];

function KanbanBoard({ tasks }: { tasks: Task[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((t) => column.statuses.includes(t.status));
        return (
          <div key={column.id} className="flex w-64 shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                {column.title}
              </span>
              <span className="rounded bg-raised px-1.5 text-[10px] tabular-nums text-fg-muted">
                {columnTasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 300px)" }}>
              {columnTasks.map((task) => (
                <TaskCardLinkWrapper key={task.id} task={task} />
              ))}
              {columnTasks.length === 0 && (
                <div className="rounded-lg border border-dashed border-line/70 px-3 py-4 text-center text-[10px] text-fg-subtle">
                  empty
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskCardLinkWrapper({ task }: { task: Task }) {
  const navigate = useNavigate();
  const { selectTask } = useUiStore();
  return (
    <div
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) {
          navigate(`/tasks/${task.id}`);
        } else {
          selectTask(task.id);
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") selectTask(task.id);
      }}
    >
      <TaskCard task={task} />
    </div>
  );
}

export function ProjectDashboardPage() {
  const { projectId = "" } = useParams();
  const project = useProject(projectId);
  const tasks = useTasks(projectId);
  const agents = useAgents();
  const events = useEvents(30);
  const [tab, setTab] = useState("board");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const taskList = useMemo(() => tasks.data ?? [], [tasks.data]);
  const projectEvents = (events.data ?? []).filter((e) => e.projectId === projectId);
  const activeAgents = (agents.data ?? []).filter(
    (a) => a.projectId === projectId && ["running", "waiting", "starting"].includes(a.status),
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return taskList.filter((task) => {
      if (typeFilter !== "all" && task.type !== typeFilter) return false;
      if (classFilter !== "all" && task.executionClass !== classFilter) return false;
      if (q && !task.title.toLowerCase().includes(q) && !task.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [taskList, search, typeFilter, classFilter]);

  const ships = taskList.filter((t) => t.type === "ship");
  const scouts = taskList.filter((t) => t.type === "scout");
  const done = taskList.filter((t) => t.status === "done");
  const failed = taskList.filter((t) => t.status === "failed");
  const pendingReview = taskList.filter((t) => t.status === "review" || t.status === "ready");
  const successRate = done.length + failed.length > 0
    ? (done.length / (done.length + failed.length)) * 100
    : null;

  if (project.isError) {
    return (
      <PageContainer title="Project">
        <ErrorState error={project.error} onRetry={() => void project.refetch()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={
        project.data ? (
          <span className="flex items-center gap-2.5">
            {project.data.name}
            <Badge tone={project.data.status === "active" ? "success" : "warning"}>
              {project.data.status}
            </Badge>
          </span>
        ) : (
          <Skeleton className="h-6 w-40" />
        )
      }
      subtitle={
        project.data ? (
          <span className="font-mono text-[11px]">{project.data.repoUrl ?? project.data.repoPath}</span>
        ) : undefined
      }
      actions={
        <>
          <LastUpdated query={tasks} />
          <Link to="/settings">
            <Button variant="ghost" aria-label="Project settings">
              <Settings size={14} />
            </Button>
          </Link>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={13} />
            New Task
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Total Tasks" value={taskList.length} />
        <StatCard label="Ships" value={ships.length} />
        <StatCard label="Scouts" value={scouts.length} />
        <StatCard label="Success" value={successRate == null ? "—" : formatPercent(successRate)} tone="accent" />
        <StatCard label="Active Agents" value={activeAgents.length} tone={activeAgents.length > 0 ? "success" : "neutral"} />
        <StatCard label="Failed" value={failed.length} tone={failed.length > 0 ? "danger" : "success"} />
        <StatCard label="Pending Review" value={pendingReview.length} tone="warning" />
      </div>

      <Tabs
        items={[
          { id: "board", label: "Board" },
          { id: "timeline", label: "Timeline", count: projectEvents.length },
          { id: "tasks", label: "All Tasks", count: taskList.length },
        ]}
        activeId={tab}
        onChange={setTab}
      />

      {(tab === "board" || tab === "tasks") && (
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search tasks…" className="w-56" />
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-8 w-28 text-xs">
            <option value="all">all types</option>
            <option value="scout">scout</option>
            <option value="ship">ship</option>
          </Select>
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="h-8 w-32 text-xs">
            <option value="all">all classes</option>
            <option value="mechanical">mechanical</option>
            <option value="standard">standard</option>
            <option value="deep">deep</option>
          </Select>
        </div>
      )}

      {tab === "board" && <KanbanBoard tasks={filtered} />}

      {tab === "tasks" && (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-line text-fg-subtle">
                <th className="px-3 py-2.5 font-medium">Task</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Progress</th>
                <th className="px-3 py-2.5 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "timeline" && (
        <div className="rounded-xl border border-line bg-panel p-3">
          {projectEvents.length === 0 && (
            <p className="px-1 py-6 text-center text-xs text-fg-subtle">No recent activity for this project.</p>
          )}
          {projectEvents.map((event) => (
            <div key={event.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-hover/50">
              <Mono className="w-14 shrink-0 text-[10px] text-fg-subtle">{event.kind}</Mono>
              <p className="min-w-0 flex-1 text-xs text-fg-muted">{event.message}</p>
              <span className="shrink-0 text-[10px] text-fg-subtle">{formatRelativeTime(event.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      <TaskCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaults={{ projectId }}
      />
    </PageContainer>
  );
}

function TaskRow({ task }: { task: Task }) {
  const { selectTask } = useUiStore();
  return (
    <tr
      onClick={() => selectTask(task.id)}
      className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-hover/60"
    >
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Mono className="text-[10px] text-fg-subtle">{task.id}</Mono>
          <span className="max-w-96 truncate text-fg-muted">{task.title}</span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <TypeBadge type={task.type} />
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={task.status} />
      </td>
      <td className="px-3 py-2.5 tabular-nums text-fg-muted">{task.progress ?? 0}%</td>
      <td className="px-3 py-2.5 text-fg-subtle">{formatRelativeTime(task.updatedAt)}</td>
    </tr>
  );
}
