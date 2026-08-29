import { useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { GitBranch, ArrowRight, Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { LastUpdated } from "@/components/common/LastUpdated";
import { Card } from "@/components/ui/card";
import { Badge, Mono } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/feedback";
import { useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { formatRelativeTime } from "@/lib/format";
import { ProjectCreateDialog } from "./ProjectCreateDialog";

export function ProjectsPage() {
  const projects = useProjects();
  const tasks = useTasks();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <PageContainer
      title="Projects"
      subtitle="Repositories managed by your hand fleet"
      actions={
        <>
          <LastUpdated query={projects} />
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={13} />
            New Project
          </Button>
        </>
      }
    >
      {projects.isError && <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />}
      {projects.isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}
      {projects.data?.length === 0 && (
        <EmptyState
          title="No projects found"
          description="Add or create a project to your hand fleet to see it here."
          action={
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={13} />
              New Project
            </Button>
          }
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.data?.map((project) => {
          const projectTasks = tasks.data?.filter((t) => t.projectId === project.id) ?? [];
          const active = projectTasks.filter((t) =>
            ["in_progress", "scouting", "review", "ready"].includes(t.status),
          ).length;
          const failed = projectTasks.filter((t) => t.status === "failed").length;
          const done = projectTasks.filter((t) => t.status === "done").length;
          const lastActivity = projectTasks.reduce(
            (max, t) => (t.updatedAt > max ? t.updatedAt : max),
            project.updatedAt ?? "",
          );
          return (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="group h-full p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GitBranch size={14} className="text-fg-subtle" />
                    <span className="text-sm font-semibold text-fg">{project.name}</span>
                  </div>
                  <Badge tone={project.status === "active" ? "success" : "warning"}>{project.status}</Badge>
                </div>
                <Mono className="mt-1.5 block truncate text-[10px]">
                  {project.repoUrl ?? project.repoPath ?? "no repository"}
                </Mono>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-fg-muted">
                  <span>
                    <span className="font-semibold text-fg tabular-nums">{projectTasks.length}</span> tasks
                  </span>
                  <span>
                    <span className="font-semibold text-success tabular-nums">{active}</span> active
                  </span>
                  <span>
                    <span className="font-semibold text-fg-muted tabular-nums">{done}</span> done
                  </span>
                  <span className={clsx(failed > 0 && "text-danger")}>
                    <span className="font-semibold tabular-nums">{failed}</span> failed
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                  <span className="text-[10px] text-fg-subtle">
                    {lastActivity ? `updated ${formatRelativeTime(lastActivity)}` : "no activity"}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-accent opacity-0 transition-opacity group-hover:opacity-100">
                    open board <ArrowRight size={11} />
                  </span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
      <ProjectCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageContainer>
  );
}
