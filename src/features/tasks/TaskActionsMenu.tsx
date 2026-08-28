import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, RotateCcw, Square, ArrowUpRight, GitBranch, TerminalSquare, ExternalLink } from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useRetryTask, useStopTask } from "@/hooks/use-tasks";
import { useOpenWorktree, useWorktrees } from "@/hooks/use-worktrees";
import type { Task } from "@/types/domain";

export function TaskActionsMenu({ task }: { task: Task }) {
  const navigate = useNavigate();
  const toast = useToast();
  const retry = useRetryTask();
  const stop = useStopTask();
  const openWorktree = useOpenWorktree();
  const { data: worktrees } = useWorktrees();
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmRetry, setConfirmRetry] = useState(false);

  const worktree = worktrees?.find((w) => w.id === task.worktreeId);
  const retryable = task.status === "failed" || task.status === "stopped" || task.status === "blocked";
  const stoppable =
    task.status === "in_progress" || task.status === "scouting" || task.status === "queued" || task.status === "ready";

  const onError = (err: unknown) => {
    const message = err instanceof Error ? err.message : "Unknown error";
    toast.showToast({ variant: "error", title: "Command failed", description: message });
  };

  return (
    <>
      <Dropdown
        trigger={
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle hover:bg-raised hover:text-fg"
            aria-label="Task actions"
          >
            <MoreHorizontal size={15} />
          </button>
        }
      >
        {(close) => (
          <>
            <DropdownItem
              icon={<ArrowUpRight size={13} />}
              onClick={() => {
                navigate(`/tasks/${task.id}`);
                close();
              }}
            >
              Open full page
            </DropdownItem>
            {task.type === "scout" && task.reportId && (
              <DropdownItem
                icon={<ExternalLink size={13} />}
                onClick={() => {
                  navigate(`/reports/${task.reportId}`);
                  close();
                }}
              >
                View report
              </DropdownItem>
            )}
            <DropdownSeparator />
            <DropdownItem
              icon={<RotateCcw size={13} />}
              disabled={!retryable || retry.isPending}
              onClick={() => {
                if (task.attempts > 0) {
                  setConfirmRetry(true);
                } else {
                  retry.mutate(task.id, { onSuccess: () => toast.showToast({ variant: "success", title: `Retry started for ${task.id}` }), onError });
                }
                close();
              }}
            >
              Retry task
            </DropdownItem>
            <DropdownItem
              icon={<Square size={13} />}
              disabled={!stoppable}
              danger
              onClick={() => {
                setConfirmStop(true);
                close();
              }}
            >
              Stop worker
            </DropdownItem>
            <DropdownSeparator />
            {worktree && (
              <>
                <DropdownItem
                  icon={<GitBranch size={13} />}
                  onClick={() => {
                    openWorktree.mutate(
                      { worktreeId: worktree.id, target: "editor" },
                      {
                        onSuccess: () =>
                          toast.showToast({ variant: "success", title: `Opening ${worktree.branch} in editor` }),
                        onError,
                      },
                    );
                    close();
                  }}
                >
                  Open worktree in editor
                </DropdownItem>
                <DropdownItem
                  icon={<TerminalSquare size={13} />}
                  onClick={() => {
                    openWorktree.mutate(
                      { worktreeId: worktree.id, target: "terminal" },
                      {
                        onSuccess: () =>
                          toast.showToast({ variant: "success", title: `Opening terminal at ${worktree.branch}` }),
                        onError,
                      },
                    );
                    close();
                  }}
                >
                  Open terminal at worktree
                </DropdownItem>
              </>
            )}
          </>
        )}
      </Dropdown>

      <ConfirmDialog
        open={confirmStop}
        onClose={() => setConfirmStop(false)}
        title={`Stop task ${task.id}?`}
        description="The assigned worker will be terminated. The worktree and any commits stay in place."
        confirmLabel="Stop worker"
        danger
        loading={stop.isPending}
        onConfirm={() => {
          stop.mutate(task.id, {
            onSuccess: () => {
              toast.showToast({ variant: "warning", title: `Task ${task.id} stopped` });
              setConfirmStop(false);
            },
            onError,
          });
        }}
      >
        <div className="space-y-1 text-xs text-fg-muted">
          <p>Task: {task.title}</p>
          {task.assignedAgentId && <p>Worker: <span className="font-mono">{task.assignedAgentId}</span></p>}
          {task.branch && <p>Branch: <span className="font-mono">{task.branch}</span></p>}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmRetry}
        onClose={() => setConfirmRetry(false)}
        title={`Retry task ${task.id}?`}
        description={`This starts attempt ${task.attempts + 1}. Previous attempt artifacts in the worktree are kept.`}
        confirmLabel="Retry"
        loading={retry.isPending}
        onConfirm={() => {
          retry.mutate(task.id, {
            onSuccess: () => {
              toast.showToast({ variant: "success", title: `Retry started for ${task.id}` });
              setConfirmRetry(false);
            },
            onError,
          });
        }}
      />
    </>
  );
}
