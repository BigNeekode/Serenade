import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  Plus,
  LayoutDashboard,
  KanbanSquare,
  Bot,
  FileText,
  GitBranch,
  Route as RouteIcon,
  Settings,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { useAgents } from "@/hooks/use-agents";
import { useReports } from "@/hooks/use-reports";
import { useWorktrees } from "@/hooks/use-worktrees";
import { useUiStore } from "@/state/ui-store";
import { useToast } from "@/components/ui/toast";

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  action: () => void;
}

export function CommandPalette({ onNewTask }: { onNewTask: () => void }) {
  const { paletteOpen, setPaletteOpen } = useUiStore();

  if (!paletteOpen) return null;

  const close = () => setPaletteOpen(false);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <div className="absolute inset-0 bg-black/60" onClick={close} />
      <PaletteContent onNewTask={onNewTask} onClose={close} />
    </div>
  );
}

/**
 * Mounted only while open, so search state resets every time the palette opens.
 */
function PaletteContent({ onNewTask, onClose }: { onNewTask: () => void; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();
  const { data: agents } = useAgents();
  const { data: reports } = useReports();
  const { data: worktrees } = useWorktrees();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items: PaletteItem[] = (() => {
    const cmd = (
      id: string,
      label: string,
      icon: React.ReactNode,
      action: () => void,
      hint?: string,
    ): PaletteItem => ({ id, group: "Commands", label, icon, action, hint });

    const commands: PaletteItem[] = [
      cmd("new-task", "New Task", <Plus size={14} />, () => {
        onClose();
        onNewTask();
      }),
      cmd("overview", "Go to Overview", <LayoutDashboard size={14} />, () => {
        navigate("/");
        onClose();
      }),
      cmd("tasks", "Go to Tasks", <KanbanSquare size={14} />, () => {
        navigate("/tasks");
        onClose();
      }),
      cmd("agents", "Show Active Agents", <Bot size={14} />, () => {
        navigate("/agents");
        onClose();
      }),
      cmd("failed", "Show Failed Tasks", <TriangleAlert size={14} />, () => {
        navigate("/tasks?status=failed");
        onClose();
      }),
      cmd("worktrees", "Show Worktrees", <GitBranch size={14} />, () => {
        navigate("/worktrees");
        onClose();
      }),
      cmd("reports", "Show Reports", <FileText size={14} />, () => {
        navigate("/reports");
        onClose();
      }),
      cmd("routes", "Show Routes & Providers", <RouteIcon size={14} />, () => {
        navigate("/routes");
        onClose();
      }),
      cmd("refresh", "Refresh Fleet", <RefreshCw size={14} />, () => {
        void queryClient.invalidateQueries();
        toast.showToast({ variant: "info", title: "Refreshing fleet data…" });
        onClose();
      }),
      cmd("settings", "Open Settings", <Settings size={14} />, () => {
        navigate("/settings");
        onClose();
      }),
    ];

    const projectItems: PaletteItem[] =
      projects?.map((p) => ({
        id: `project-${p.id}`,
        group: "Projects",
        label: p.name,
        hint: p.repoUrl ?? p.repoPath,
        icon: <LayoutDashboard size={14} />,
        action: () => {
          navigate(`/projects/${p.id}`);
          onClose();
        },
      })) ?? [];

    const taskItems: PaletteItem[] =
      tasks?.map((t) => ({
        id: `task-${t.id}`,
        group: "Tasks",
        label: t.title,
        hint: t.id,
        icon: <KanbanSquare size={14} />,
        action: () => {
          navigate(`/tasks/${t.id}`);
          onClose();
        },
      })) ?? [];

    const agentItems: PaletteItem[] =
      agents?.map((a) => ({
        id: `agent-${a.id}`,
        group: "Agents",
        label: `${a.id} — ${a.provider}/${a.model ?? "?"}`,
        hint: a.branch,
        icon: <Bot size={14} />,
        action: () => {
          navigate("/agents");
          onClose();
        },
      })) ?? [];

    const reportItems: PaletteItem[] =
      reports?.map((r) => ({
        id: `report-${r.id}`,
        group: "Reports",
        label: r.title,
        hint: r.id,
        icon: <FileText size={14} />,
        action: () => {
          navigate(`/reports/${r.id}`);
          onClose();
        },
      })) ?? [];

    const worktreeItems: PaletteItem[] =
      worktrees?.map((w) => ({
        id: `worktree-${w.id}`,
        group: "Worktrees",
        label: w.branch,
        hint: w.path,
        icon: <GitBranch size={14} />,
        action: () => {
          navigate("/worktrees");
          onClose();
        },
      })) ?? [];

    const all = [...commands, ...projectItems, ...taskItems, ...agentItems, ...reportItems, ...worktreeItems];
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.hint ?? "").toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q),
    );
  })();

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[activeIndex]?.action();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  let lastGroup = "";

  return (
    <div
      role="dialog"
      aria-label="Command palette"
      className="relative w-full max-w-xl overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl"
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search commands, projects, tasks, agents, reports…"
        className="w-full border-b border-line bg-transparent px-4 py-3.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
      />
      <div className="max-h-96 overflow-y-auto py-1.5">
        {items.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-fg-subtle">No matches for “{query}”</p>
        )}
        {items.map((item, i) => {
          const showGroup = item.group !== lastGroup;
          lastGroup = item.group;
          return (
            <div key={item.id}>
              {showGroup && (
                <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                  {item.group}
                </p>
              )}
              <button
                onMouseEnter={() => setActiveIndex(i)}
                onClick={item.action}
                className={clsx(
                  "flex w-full items-center gap-2.5 px-4 py-2 text-left text-xs transition-colors",
                  i === activeIndex ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-hover",
                )}
              >
                <span className="text-fg-subtle">{item.icon}</span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint && (
                  <span className="max-w-40 truncate font-mono text-[10px] text-fg-subtle">{item.hint}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[10px] text-fg-subtle">
        <span>↑↓ navigate</span>
        <span>↵ open</span>
        <span>esc close</span>
      </div>
    </div>
  );
}
