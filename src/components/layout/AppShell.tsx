import { useEffect, useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { StatusBar } from "./StatusBar";
import { ContextPanel } from "./ContextPanel";
import { CommandPalette } from "@/components/common/CommandPalette";
import { TaskCreateDialog } from "@/features/tasks/TaskCreateDialog";
import { useUiStore } from "@/state/ui-store";

export function AppShell() {
  const { setPaletteOpen } = useUiStore();
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen]);

  return (
    <div className="flex h-full flex-col bg-base">
      <Topbar onNewTask={() => setNewTaskOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
        <ContextPanel />
      </div>
      <StatusBar />
      <CommandPalette onNewTask={() => setNewTaskOpen(true)} />
      <TaskCreateDialog open={newTaskOpen} onClose={() => setNewTaskOpen(false)} />
    </div>
  );
}

export function PageContainer({
  title,
  subtitle,
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight text-fg">{title}</h1>
          {subtitle && <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
