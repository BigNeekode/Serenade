import { Link, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { ChevronRight, Search, Plus, Settings, PanelLeft } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { useEnvironment } from "@/hooks/use-config";
import { useUiStore } from "@/state/ui-store";

function useBreadcrumbs() {
  const location = useLocation();
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();
  const segments = location.pathname.split("/").filter(Boolean);

  const projectName = (id: string) => projects?.find((p) => p.id === id)?.name ?? id;
  const taskTitle = (id: string) => tasks?.find((t) => t.id === id)?.title ?? id;

  if (segments.length === 0) return [{ label: "Overview", to: "/" }];

  const root = segments[0];
  const rootLabels: Record<string, string> = {
    supervisor: "Supervisor",
    projects: "Projects",
    tasks: "Tasks",
    agents: "Agents",
    worktrees: "Worktrees",
    reports: "Reports",
    routes: "Routes & Providers",
    settings: "Settings",
    setup: "Setup",
  };
  const crumbs = [{ label: rootLabels[root] ?? root, to: `/${root}` }];

  if (root === "projects" && segments[1]) {
    crumbs.push({ label: projectName(segments[1]), to: `/projects/${segments[1]}` });
  }
  if (root === "tasks" && segments[1]) {
    crumbs.push({ label: taskTitle(segments[1]), to: `/tasks/${segments[1]}` });
  }
  if (root === "reports" && segments[1]) {
    crumbs.push({ label: segments[1], to: `/reports/${segments[1]}` });
  }
  return crumbs;
}

function ProjectSwitcher() {
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const { selectedProjectId, setSelectedProjectId } = useUiStore();
  const selected = projects?.find((p) => p.id === selectedProjectId);
  return (
    <Dropdown
      trigger={
        <button className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs text-fg-muted hover:border-line-strong hover:text-fg transition-colors">
          <span
            className={clsx(
              "h-1.5 w-1.5 rounded-full",
              selected?.status === "active" ? "bg-success" : selected ? "bg-warning" : "bg-fg-subtle",
            )}
          />
          {selected?.name ?? "All projects"}
        </button>
      }
    >
      {(close) => (
        <>
          <DropdownItem
            onClick={() => {
              setSelectedProjectId(null);
              close();
            }}
          >
            All projects
          </DropdownItem>
          <div className="my-1 border-t border-line" />
          {projects?.map((p) => (
            <DropdownItem
              key={p.id}
              onClick={() => {
                setSelectedProjectId(p.id);
                navigate(`/projects/${p.id}`);
                close();
              }}
            >
              <span className="flex items-center gap-2">
                <span
                  className={clsx(
                    "h-1.5 w-1.5 rounded-full",
                    p.status === "active" ? "bg-success" : "bg-warning",
                  )}
                />
                {p.name}
              </span>
            </DropdownItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}

export function Topbar({ onNewTask }: { onNewTask: () => void }) {
  const crumbs = useBreadcrumbs();
  const { setPaletteOpen, toggleSidebar } = useUiStore();
  const { data: env } = useEnvironment();

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
      <IconButton variant="ghost" onClick={toggleSidebar} aria-label="Toggle sidebar">
        <PanelLeft size={15} />
      </IconButton>
      <nav className="flex min-w-0 items-center gap-1 text-xs" aria-label="Breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={crumb.to} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="shrink-0 text-fg-subtle" />}
            {i === crumbs.length - 1 ? (
              <span className="truncate font-medium text-fg">{crumb.label}</span>
            ) : (
              <Link to={crumb.to} className="truncate text-fg-subtle hover:text-fg-muted">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <ProjectSwitcher />
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex h-7 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-xs text-fg-subtle hover:border-line-strong hover:text-fg-muted transition-colors"
        >
          <Search size={12} />
          <span>Search…</span>
          <kbd className="rounded border border-line bg-raised px-1 font-mono text-[10px]">Ctrl K</kbd>
        </button>
        <Button variant="primary" size="sm" onClick={onNewTask}>
          <Plus size={13} />
          New Task
        </Button>
        <Link to="/settings" aria-label="Settings">
          <IconButton variant="ghost" aria-label="Open settings">
            <Settings size={15} />
          </IconButton>
        </Link>
        <Tooltip
          label={env?.ok ? `hand ${env.handVersion ?? ""} • fleet ready`.trim() : "Environment issues — open Settings"}
        >
          <span
            className={clsx(
              "h-2 w-2 rounded-full",
              env?.ok ? "bg-success" : env ? "bg-warning" : "bg-fg-subtle",
            )}
            aria-label="Environment status"
          />
        </Tooltip>
      </div>
    </header>
  );
}
