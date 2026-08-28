import { useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { X, ArrowUpRight } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { TaskDetailPanel } from "@/features/tasks/TaskDetailPanel";
import { AgentDetailPanel } from "@/features/agents/AgentDetailPanel";
import { useUiStore } from "@/state/ui-store";

export function ContextPanel() {
  const { selectedTaskId, selectTask, selectedAgentId, selectAgent, panelWidth, setPanelWidth } =
    useUiStore();
  const dragging = useRef(false);
  const open = !!selectedTaskId || !!selectedAgentId;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) {
        setPanelWidth(window.innerWidth - e.clientX);
      }
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setPanelWidth]);

  const startDrag = useCallback(() => {
    dragging.current = true;
    document.body.style.userSelect = "none";
  }, []);

  if (!open) return null;

  const headerId = selectedTaskId ?? selectedAgentId ?? "";
  const fullLink = selectedTaskId ? `/tasks/${selectedTaskId}` : `/agents`;

  return (
    <aside
      className="relative flex shrink-0 flex-col border-l border-line bg-surface"
      style={{ width: panelWidth }}
    >
      <div
        onMouseDown={startDrag}
        className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize hover:bg-accent/40"
        aria-label="Resize panel"
      />
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
        <span className="truncate font-mono text-xs text-fg-subtle">{headerId}</span>
        <div className="flex items-center gap-1">
          <Link to={fullLink} aria-label="Open full page">
            <IconButton variant="ghost" size="xs" aria-label="Open full page">
              <ArrowUpRight size={13} />
            </IconButton>
          </Link>
          <IconButton
            variant="ghost"
            size="xs"
            aria-label="Close panel"
            onClick={() => {
              selectTask(null);
              selectAgent(null);
            }}
          >
            <X size={14} />
          </IconButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {selectedTaskId ? (
          <TaskDetailPanel taskId={selectedTaskId} />
        ) : (
          <AgentDetailPanel agentId={selectedAgentId!} />
        )}
      </div>
    </aside>
  );
}
