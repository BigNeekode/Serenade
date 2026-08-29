import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, RotateCcw, Square, ArrowUpRight, GitBranch, TerminalSquare, ExternalLink, GitMerge, PackageCheck, Archive } from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useDeliverTask, useFinalizeTask, useMergeTaskLocal, useRetryTask, useStopTask } from "@/hooks/use-tasks";
import { useOpenWorktree, useWorktrees } from "@/hooks/use-worktrees";
import type { Task } from "@/types/domain";

export function TaskActionsMenu({ task }: { task: Task }) {
  const navigate = useNavigate();
  const toast = useToast();
  const retry = useRetryTask();
  const stop = useStopTask();
  const openWorktree = useOpenWorktree();
  const mergeLocal = useMergeTaskLocal();
  const deliver = useDeliverTask();
  const finalize = useFinalizeTask();
  const { data: worktrees } = useWorktrees();
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmRetry, setConfirmRetry] = useState(false);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [confirmDeliver, setConfirmDeliver] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);

  const worktree = worktrees?.find((w) => w.id === task.worktreeId);
  const retryable =
    task.status === "failed" ||
    task.status === "stopped" ||
    task.status === "blocked" ||
    task.lineage?.activeAttempt?.lifecycle === "provisioning";
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
            {task.status === "review" && (
              <>
                <DropdownItem
                  icon={<GitMerge size={13} />}
                  onClick={() => {
                    setConfirmMerge(true);
                    close();
                  }}
                >
                  Merge into main
                </DropdownItem>
                <DropdownItem
                  icon={<PackageCheck size={13} />}
                  onClick={() => {
                    setConfirmDeliver(true);
                    close();
                  }}
                >
                  Mark delivered
                </DropdownItem>
                <DropdownSeparator />
              </>
            )}
            {task.status === "done" && (
              <>
                <DropdownItem
                  icon={<Archive size={13} />}
                  onClick={() => {
                    setConfirmFinalize(true);
                    close();
                  }}
                >
                  Finalize task
                </DropdownItem>
                <DropdownSeparator />
              </>
            )}
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
        description="This runs `hand teardown --force`: the task is finalized, its worktree is returned to the pool, and the worker pane is closed. Commits already pushed stay safe."
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

      <ConfirmDialog
        open={confirmMerge}
        onClose={() => setConfirmMerge(false)}
        title={`Merge ${task.id} into main?`}
        description="Hand will perform a safe local merge and refuse if the branch cannot be landed cleanly. Review the task changes first."
        confirmLabel="Merge into main"
        loading={mergeLocal.isPending}
        onConfirm={() => {
          mergeLocal.mutate(task.id, {
            onSuccess: () => {
              toast.showToast({ variant: "success", title: `Task ${task.id} merged` });
              setConfirmMerge(false);
            },
            onError,
          });
        }}
      />

      <ConfirmDialog
        open={confirmDeliver}
        onClose={() => setConfirmDeliver(false)}
        title={`Mark ${task.id} delivered?`}
        description="Use this when the reviewed branch is handed off and another person or integration task controls whether it lands. This does not merge into main."
        confirmLabel="Mark delivered"
        loading={deliver.isPending}
        onConfirm={() => {
          deliver.mutate(task.id, {
            onSuccess: () => {
              toast.showToast({ variant: "success", title: `Task ${task.id} delivered` });
              setConfirmDeliver(false);
            },
            onError,
          });
        }}
      />

      <ConfirmDialog
        open={confirmFinalize}
        onClose={() => setConfirmFinalize(false)}
        title={`Finalize ${task.id}?`}
        description="This closes the worker pane and returns the worktree. Hand will refuse if the work has not been merged or explicitly delivered."
        confirmLabel="Finalize task"
        loading={finalize.isPending}
        onConfirm={() => {
          finalize.mutate(task.id, {
            onSuccess: () => {
              toast.showToast({ variant: "success", title: `Task ${task.id} finalized` });
              setConfirmFinalize(false);
            },
            onError,
          });
        }}
      />
    </>
  );
}
