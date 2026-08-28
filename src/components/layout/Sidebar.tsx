import { NavLink } from "react-router-dom";
import clsx from "clsx";
import {
  LayoutDashboard,
  FolderGit2,
  KanbanSquare,
  Bot,
  GitBranch,
  FileText,
  Route,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { useUiStore } from "@/state/ui-store";

const items = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/projects", label: "Projects", icon: FolderGit2, end: false },
  { to: "/tasks", label: "Tasks", icon: KanbanSquare, end: false },
  { to: "/agents", label: "Agents", icon: Bot, end: false },
  { to: "/worktrees", label: "Worktrees", icon: GitBranch, end: false },
  { to: "/reports", label: "Reports", icon: FileText, end: false },
  { to: "/routes", label: "Routes", icon: Route, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <aside
      className={clsx(
        "flex shrink-0 flex-col border-r border-line bg-surface transition-all",
        sidebarCollapsed ? "w-13" : "w-48",
      )}
    >
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-accent-soft text-accent"
                  : "text-fg-muted hover:bg-raised hover:text-fg",
              )
            }
          >
            {sidebarCollapsed ? (
              <Tooltip label={label} side="right">
                <Icon size={15} className="shrink-0" />
              </Tooltip>
            ) : (
              <Icon size={15} className="shrink-0" />
            )}
            {!sidebarCollapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line p-2">
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-fg-subtle hover:bg-raised hover:text-fg-muted"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
