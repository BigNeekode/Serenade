import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { LastUpdated } from "@/components/common/LastUpdated";
import { Button } from "@/components/ui/button";
import { SearchInput, Select } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Mono, StatusBadge, TypeBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TaskCreateDialog } from "@/features/tasks/TaskCreateDialog";
import { useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useUiStore } from "@/state/ui-store";
import { formatRelativeTime } from "@/lib/format";
import type { Task } from "@/types/domain";

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "all";
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const tasks = useTasks();
  const { data: projects } = useProjects();
  const { selectTask } = useUiStore();

  const projectName = (id: string) => projects?.find((p) => p.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (tasks.data ?? []).filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (typeFilter !== "all" && task.type !== typeFilter) return false;
      if (projectFilter !== "all" && task.projectId !== projectFilter) return false;
      if (q && !task.title.toLowerCase().includes(q) && !task.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks.data, search, statusFilter, typeFilter, projectFilter]);

  const columns: Column<Task>[] = [
    {
      key: "title",
      header: "Task",
      sortValue: (t) => t.title,
      render: (t) => (
        <div className="flex items-center gap-2">
          <Mono className="text-[10px] text-fg-subtle">{t.id}</Mono>
          <span className="block max-w-105 truncate text-fg-muted">{t.title}</span>
        </div>
      ),
    },
    {
      key: "project",
      header: "Project",
      sortValue: (t) => t.projectId,
      render: (t) => <span className="text-fg-muted">{projectName(t.projectId)}</span>,
    },
    { key: "type", header: "Type", sortValue: (t) => t.type, render: (t) => <TypeBadge type={t.type} /> },
    {
      key: "class",
      header: "Class",
      sortValue: (t) => t.executionClass,
      render: (t) => <span className="text-fg-subtle">{t.executionClass}</span>,
    },
    { key: "status", header: "Status", sortValue: (t) => t.status, render: (t) => <StatusBadge status={t.status} /> },
    {
      key: "progress",
      header: "Progress",
      sortValue: (t) => t.progress ?? 0,
      render: (t) => (
        <div className="flex w-20 items-center gap-2">
          <ProgressBar value={t.progress} tone={t.status === "failed" ? "danger" : "accent"} />
          <span className="shrink-0 tabular-nums text-fg-subtle">{t.progress ?? 0}%</span>
        </div>
      ),
    },
    {
      key: "updated",
      header: "Updated",
      sortValue: (t) => t.updatedAt,
      render: (t) => <span className="text-fg-subtle">{formatRelativeTime(t.updatedAt)}</span>,
    },
  ];

  return (
    <PageContainer
      title="Tasks"
      subtitle="All scout and ship work across the fleet"
      actions={
        <>
          <LastUpdated query={tasks} />
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={13} />
            New Task
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search tasks…" className="w-56" />
        <Select
          value={statusFilter}
          onChange={(e) => {
            const value = e.target.value;
            setSearchParams(value === "all" ? {} : { status: value });
          }}
          className="h-8 w-36 text-xs"
        >
          <option value="all">all statuses</option>
          <option value="backlog">backlog</option>
          <option value="queued">queued</option>
          <option value="scouting">scouting</option>
          <option value="ready">ready to ship</option>
          <option value="in_progress">in progress</option>
          <option value="review">review</option>
          <option value="done">done</option>
          <option value="blocked">blocked</option>
          <option value="failed">failed</option>
          <option value="stopped">stopped</option>
        </Select>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-8 w-28 text-xs">
          <option value="all">all types</option>
          <option value="scout">scout</option>
          <option value="ship">ship</option>
        </Select>
        <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="h-8 w-36 text-xs">
          <option value="all">all projects</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        getKey={(t) => t.id}
        onRowClick={(t) => selectTask(t.id)}
        loading={tasks.isLoading}
        initialSortKey="updated"
        emptyTitle={search ? "No tasks match your filters" : "No tasks yet"}
        emptyDescription={search ? "Try clearing the search or filters." : "Create a task to get started."}
      />

      <TaskCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageContainer>
  );
}
