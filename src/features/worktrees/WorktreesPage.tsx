import { useMemo, useState } from "react";
import {
  Copy,
  FolderOpen,
  GitBranch,
  MoreHorizontal,
  SquareTerminal,
  Trash2,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { LastUpdated } from "@/components/common/LastUpdated";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { Mono, StatusBadge } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { SearchInput, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useWorktrees, useCleanupWorktree, useOpenWorktree } from "@/hooks/use-worktrees";
import { useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { useAgents } from "@/hooks/use-agents";
import { formatRelativeTime } from "@/lib/format";
import type { Worktree } from "@/types/domain";

export function WorktreesPage() {
  const worktrees = useWorktrees();
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();
  const { data: agents } = useAgents();
  const cleanup = useCleanupWorktree();
  const openWorktree = useOpenWorktree();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [cleanupTarget, setCleanupTarget] = useState<Worktree | null>(null);

  const projectName = (id?: string) => projects?.find((p) => p.id === id)?.name ?? id ?? "—";
  const task = (id?: string) => tasks?.find((t) => t.id === id);
  const agent = (id?: string) => agents?.find((a) => a.id === id);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (worktrees.data ?? []).filter((w) => {
      if (projectFilter !== "all" && w.projectId !== projectFilter) return false;
      if (stateFilter !== "all" && w.state !== stateFilter) return false;
      if (q && !w.path.toLowerCase().includes(q) && !w.branch.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [worktrees.data, search, projectFilter, stateFilter]);

  const onActionError = (err: unknown) =>
    toast.showToast({
      variant: "error",
      title: "Command failed",
      description: err instanceof Error ? err.message : undefined,
    });

  const columns: Column<Worktree>[] = [
    {
      key: "project",
      header: "Project",
      sortValue: (w) => w.projectId,
      render: (w) => <span className="text-fg-muted">{projectName(w.projectId)}</span>,
    },
    {
      key: "task",
      header: "Task",
      render: (w) =>
        w.taskId ? (
          <Mono className="text-accent">{w.taskId}</Mono>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      key: "branch",
      header: "Branch",
      sortValue: (w) => w.branch,
      render: (w) => (
        <span className="flex items-center gap-1.5">
          <GitBranch size={11} className="text-fg-subtle" />
          <Mono>{w.branch}</Mono>
        </span>
      ),
    },
    {
      key: "path",
      header: "Path",
      render: (w) => (
        <span className="block max-w-64 truncate font-mono text-[10px] text-fg-subtle" title={w.path}>
          {w.path}
        </span>
      ),
    },
    {
      key: "git",
      header: "Git",
      sortValue: (w) => w.gitStatus ?? "",
      render: (w) => <StatusBadge status={w.gitStatus ?? "unknown"} kind="git" />,
    },
    {
      key: "changed",
      header: "Changed",
      sortValue: (w) => w.changedFiles ?? 0,
      render: (w) => <span className="tabular-nums text-fg-muted">{w.changedFiles ?? 0}</span>,
    },
    {
      key: "aheadbehind",
      header: "↑/↓",
      render: (w) => (
        <span className="tabular-nums text-fg-subtle">
          {w.aheadBehind?.[0] ?? 0}/{w.aheadBehind?.[1] ?? 0}
        </span>
      ),
    },
    {
      key: "state",
      header: "State",
      sortValue: (w) => w.state,
      render: (w) => <Badge tone={w.state === "orphaned" ? "warning" : w.state === "ready-for-review" ? "accent" : "neutral"}>{w.state.replaceAll("-", " ")}</Badge>,
    },
    {
      key: "created",
      header: "Created",
      sortValue: (w) => w.createdAt ?? "",
      render: (w) => <span className="text-fg-subtle">{formatRelativeTime(w.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-9",
      render: (w) => (
        <Dropdown
          trigger={
            <button
              className="flex h-6 w-6 items-center justify-center rounded text-fg-subtle hover:bg-raised hover:text-fg"
              aria-label={`Actions for ${w.branch}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal size={14} />
            </button>
          }
        >
          {(close) => (
            <>
              <DropdownItem
                icon={<FolderOpen size={13} />}
                onClick={() => {
                  openWorktree.mutate(
                    { worktreeId: w.id, target: "editor" },
                    { onSuccess: () => toast.showToast({ variant: "success", title: `Opening ${w.branch} in editor` }), onError: onActionError },
                  );
                  close();
                }}
              >
                Open in editor
              </DropdownItem>
              <DropdownItem
                icon={<FolderOpen size={13} />}
                onClick={() => {
                  openWorktree.mutate(
                    { worktreeId: w.id, target: "folder" },
                    { onSuccess: () => toast.showToast({ variant: "success", title: `Opening folder for ${w.branch}` }), onError: onActionError },
                  );
                  close();
                }}
              >
                Open folder
              </DropdownItem>
              <DropdownItem
                icon={<SquareTerminal size={13} />}
                onClick={() => {
                  openWorktree.mutate(
                    { worktreeId: w.id, target: "terminal" },
                    { onSuccess: () => toast.showToast({ variant: "success", title: `Opening terminal at ${w.branch}` }), onError: onActionError },
                  );
                  close();
                }}
              >
                Open terminal
              </DropdownItem>
              <DropdownItem
                icon={<Copy size={13} />}
                onClick={() => {
                  void navigator.clipboard?.writeText(w.path);
                  toast.showToast({ variant: "success", title: "Path copied" });
                  close();
                }}
              >
                Copy path
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem
                danger
                icon={<Trash2 size={13} />}
                onClick={() => {
                  setCleanupTarget(w);
                  close();
                }}
              >
                Cleanup worktree
              </DropdownItem>
            </>
          )}
        </Dropdown>
      ),
    },
  ];

  return (
    <PageContainer
      title="Worktrees"
      subtitle="Isolated checkout per task — keep an eye on what each worker touches"
      actions={<LastUpdated query={worktrees} />}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search branch or path…" className="w-56" />
        <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="h-8 w-36 text-xs">
          <option value="all">all projects</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="h-8 w-40 text-xs">
          <option value="all">all states</option>
          <option value="active">active</option>
          <option value="idle">idle</option>
          <option value="ready-for-review">ready for review</option>
          <option value="orphaned">orphaned</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        getKey={(w) => w.id}
        loading={worktrees.isLoading}
        emptyTitle="No worktrees"
        emptyDescription="Worktrees appear when workers start on ship tasks."
      />

      <ConfirmDialog
        open={!!cleanupTarget}
        onClose={() => setCleanupTarget(null)}
        title="Cleanup worktree?"
        description="This permanently removes the worktree directory and its branch checkout."
        confirmLabel="Remove worktree"
        danger
        loading={cleanup.isPending}
        onConfirm={() => {
          if (!cleanupTarget) return;
          cleanup.mutate(cleanupTarget.id, {
            onSuccess: () => {
              toast.showToast({
                variant: "success",
                title: "Worktree removed",
                description: cleanupTarget.branch,
              });
              setCleanupTarget(null);
            },
            onError: onActionError,
          });
        }}
      >
        {cleanupTarget && (
          <div className="space-y-1.5 text-xs">
            <p className="text-fg-muted">
              Path: <span className="font-mono text-[11px]">{cleanupTarget.path}</span>
            </p>
            <p className="text-fg-muted">
              Branch: <span className="font-mono text-[11px]">{cleanupTarget.branch}</span>
            </p>
            <p className={cleanupTarget.changedFiles ? "text-warning" : "text-fg-muted"}>
              Uncommitted files: <span className="tabular-nums">{cleanupTarget.changedFiles ?? 0}</span>
            </p>
            <p className="text-fg-muted">
              Last commit: <span className="font-mono text-[11px]">{cleanupTarget.lastCommit ?? "—"}</span>
            </p>
            <p className="text-fg-muted">
              Task: {cleanupTarget.taskId ? (
                <span className="font-mono text-[11px]">{cleanupTarget.taskId}</span>
              ) : "—"}
              {agent(cleanupTarget.agentId) && (
                <span className="text-fg-subtle"> (worker {cleanupTarget.agentId})</span>
              )}
            </p>
            {task(cleanupTarget.taskId) && (
              <p className="text-fg-subtle">{task(cleanupTarget.taskId)!.title}</p>
            )}
          </div>
        )}
      </ConfirmDialog>
    </PageContainer>
  );
}
