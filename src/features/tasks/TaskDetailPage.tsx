import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Copy,
  FileText,
  GitCommitHorizontal,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { LastUpdated } from "@/components/common/LastUpdated";
import { MarkdownView } from "@/components/common/MarkdownView";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { ClassBadge, Mono, StatusBadge, Tag, TypeBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useTask, useSendTaskMessage, usePromoteTask } from "@/hooks/use-tasks";
import { useTaskLogs } from "@/hooks/use-logs";
import { useAgents } from "@/hooks/use-agents";
import { useWorktrees } from "@/hooks/use-worktrees";
import { useReport } from "@/hooks/use-reports";
import { useProject } from "@/hooks/use-projects";
import { TaskActionsMenu } from "./TaskActionsMenu";
import { TaskCreateDialog } from "./TaskCreateDialog";
import {
  formatCost,
  formatDuration,
  formatRelativeTime,
  formatTimestamp,
  formatTokens,
} from "@/lib/format";
import type { LogLine } from "@/types/domain";

export function useTaskLookup(taskId: string) {
  const task = useTask(taskId);
  const agents = useAgents();
  const worktrees = useWorktrees();
  const project = useProject(task.data?.projectId ?? "");
  const report = useReport(task.data?.reportId ?? "");
  const agent = agents.data?.find((a) => a.id === task.data?.assignedAgentId);
  const worktree = worktrees.data?.find((w) => w.id === task.data?.worktreeId);
  return { task, agent, worktree, project, report };
}

export function LogLineRow({ line }: { line: LogLine }) {
  const sourceColor =
    line.source === "supervisor" ? "text-accent" : line.source === "system" ? "text-fg-subtle" : "text-fg-muted";
  const levelColor =
    line.level === "error"
      ? "text-danger"
      : line.level === "warn"
        ? "text-warning"
        : line.level === "success"
          ? "text-success"
          : "text-fg-muted";
  return (
    <div className="flex gap-2.5 px-3 py-1 hover:bg-hover/40">
      <span className="w-16 shrink-0 font-mono text-[10px] leading-5 text-fg-subtle">
        {formatTimestamp(line.ts)}
      </span>
      <span className={`w-20 shrink-0 text-[10px] font-semibold uppercase leading-5 ${sourceColor}`}>
        {line.source}
      </span>
      <span className={`min-w-0 flex-1 text-xs leading-5 break-words ${levelColor}`}>{line.message}</span>
    </div>
  );
}

export function TaskChatTab({ taskId, compact = false }: { taskId: string; compact?: boolean }) {
  const toast = useToast();
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const logs = useTaskLogs(taskId, { paused });
  const sendMessage = useSendTaskMessage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => logs.data?.pages.flatMap((p) => p.lines) ?? [], [logs.data]);
  const filtered = useMemo(() => {
    if (!search.trim()) return lines;
    const q = search.toLowerCase();
    return lines.filter(
      (l) => l.message.toLowerCase().includes(q) || l.source.toLowerCase().includes(q),
    );
  }, [lines, search]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length, autoScroll]);

  const send = () => {
    const text = message.trim();
    if (!text) return;
    setMessage("");
    sendMessage.mutate(
      { taskId, message: text },
      {
        onSuccess: () => toast.showToast({ variant: "success", title: "Instruction sent" }),
        onError: (err) =>
          toast.showToast({
            variant: "error",
            title: "Could not send instruction",
            description: err instanceof Error ? err.message : undefined,
          }),
      },
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="filter logs…"
          className="h-7 w-44 rounded-md border border-line bg-surface px-2.5 text-xs text-fg placeholder:text-fg-subtle focus:border-accent/70 focus:outline-none"
        />
        <button
          onClick={() => setPaused((p) => !p)}
          className={`rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
            paused
              ? "border-warning/40 bg-warning-soft text-warning"
              : "border-line bg-raised text-fg-subtle hover:text-fg-muted"
          }`}
        >
          {paused ? "paused" : "live"}
        </button>
        <button
          onClick={() => setAutoScroll((a) => !a)}
          className={`rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
            autoScroll
              ? "border-accent/40 bg-accent-soft text-accent"
              : "border-line bg-raised text-fg-subtle hover:text-fg-muted"
          }`}
        >
          auto-scroll
        </button>
        {logs.hasNextPage && (
          <button
            onClick={() => logs.fetchNextPage()}
            className="rounded-md border border-line bg-raised px-2 py-1 text-[10px] font-medium text-fg-subtle hover:text-fg-muted"
          >
            load older
          </button>
        )}
        <span className="ml-auto text-[10px] text-fg-subtle">{filtered.length} lines</span>
      </div>

      <div
        ref={scrollRef}
        className="min-h-40 flex-1 overflow-y-auto rounded-lg border border-line bg-black/20 py-1.5"
        style={{ maxHeight: compact ? 280 : undefined }}
      >
        {logs.isLoading && <p className="px-3 py-2 text-xs text-fg-subtle">loading logs…</p>}
        {filtered.map((line) => (
          <LogLineRow key={line.id} line={line} />
        ))}
        {!logs.isLoading && filtered.length === 0 && (
          <p className="px-3 py-2 text-xs text-fg-subtle">no matching log lines</p>
        )}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          rows={compact ? 2 : 3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Send an instruction to the worker… (Enter to send, Shift+Enter for newline)"
        />
        <Button variant="primary" onClick={send} loading={sendMessage.isPending} disabled={!message.trim()}>
          <Send size={13} />
          Send
        </Button>
      </div>
    </div>
  );
}

function ProgressTab({ taskId }: { taskId: string }) {
  const { task, agent } = useTaskLookup(taskId);
  const logs = useTaskLogs(taskId, { poll: false });
  const lines = logs.data?.pages.flatMap((p) => p.lines) ?? [];
  const timeline = lines.filter((l) => l.source === "supervisor" || l.source === "system");

  if (task.isLoading) return <Skeleton className="h-40" />;
  if (!task.data) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Attempt" />
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-fg-muted">Progress</span>
            <span className="tabular-nums text-fg">{task.data.progress ?? 0}%</span>
          </div>
          <ProgressBar
            value={task.data.progress}
            tone={task.data.status === "failed" ? "danger" : "accent"}
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-fg-muted">Attempt</span>
            <span className="tabular-nums text-fg">{task.data.attempts + 1}</span>
          </div>
          {agent && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-fg-muted">Worker runtime</span>
                <span className="text-fg">{formatDuration(agent.startedAt, agent.endedAt)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-fg-muted">Last heartbeat</span>
                <span className="text-fg">{formatRelativeTime(agent.heartbeatAt)}</span>
              </div>
            </>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader title="Status timeline" />
        <div className="max-h-80 space-y-0 overflow-y-auto p-3">
          {timeline.map((line) => (
            <div key={line.id} className="flex gap-3 border-l border-line py-1.5 pl-3 -ml-px">
              <span className="min-w-0 flex-1 text-xs text-fg-muted">{line.message}</span>
              <span className="shrink-0 font-mono text-[10px] text-fg-subtle">
                {formatTimestamp(line.ts)}
              </span>
            </div>
          ))}
          {timeline.length === 0 && <p className="p-2 text-xs text-fg-subtle">no events yet</p>}
        </div>
      </Card>
    </div>
  );
}

function FilesTab({ taskId }: { taskId: string }) {
  const { worktree } = useTaskLookup(taskId);
  const toast = useToast();

  if (!worktree) {
    return (
      <EmptyState
        title="No worktree"
        description="A worktree is created when a worker starts implementing this task."
        icon={<FileText size={18} />}
      />
    );
  }
  return (
    <Card>
      <CardHeader
        title="Worktree"
        action={
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              void navigator.clipboard?.writeText(worktree.path);
              toast.showToast({ variant: "success", title: "Path copied" });
            }}
          >
            <Copy size={11} />
            Copy path
          </Button>
        }
      />
      <div className="grid gap-x-8 gap-y-2.5 p-4 text-xs sm:grid-cols-2">
        <Detail label="Path" value={worktree.path} mono />
        <Detail label="Branch" value={worktree.branch} mono />
        <Detail label="Git status" value={worktree.gitStatus ?? "unknown"} />
        <Detail label="Changed files" value={String(worktree.changedFiles ?? 0)} />
        <Detail label="Ahead / behind" value={`${worktree.aheadBehind?.[0] ?? 0} / ${worktree.aheadBehind?.[1] ?? 0}`} />
        <Detail label="Last commit" value={worktree.lastCommit ?? "—"} mono />
      </div>
      <p className="border-t border-line px-4 py-2.5 text-[10px] text-fg-subtle">
        Per-file diff viewing is planned post-MVP (see docs/design.md §26).
      </p>
    </Card>
  );
}

function CommitsTab({ taskId }: { taskId: string }) {
  const { worktree } = useTaskLookup(taskId);
  if (!worktree) {
    return <EmptyState title="No commits" description="No worktree is associated with this task." icon={<GitCommitHorizontal size={18} />} />;
  }
  return (
    <Card>
      <CardHeader title={`Commits on ${worktree.branch}`} />
      <div className="divide-y divide-line/60">
        <div className="flex items-center gap-3 px-4 py-3 text-xs">
          <GitCommitHorizontal size={14} className="shrink-0 text-fg-subtle" />
          <span className="min-w-0 flex-1 truncate text-fg-muted">{worktree.lastCommit ?? "no commits"}</span>
          <span className="shrink-0 text-fg-subtle">
            {worktree.aheadBehind?.[0] ?? 0} ahead
          </span>
        </div>
      </div>
      <p className="border-t border-line px-4 py-2.5 text-[10px] text-fg-subtle">
        Full commit history becomes available once the Git adapter ships (Milestone 16).
      </p>
    </Card>
  );
}

function ReportTab({ taskId }: { taskId: string }) {
  const { task, report } = useTaskLookup(taskId);
  const promote = usePromoteTask();
  const navigate = useNavigate();
  const toast = useToast();
  const [followUpOpen, setFollowUpOpen] = useState(false);

  if (!task.data?.reportId) {
    return (
      <EmptyState
        title="No report yet"
        description="Scout tasks produce a report when they complete. Ship tasks get a run summary."
        icon={<FileText size={18} />}
      />
    );
  }
  if (report.isLoading) return <Skeleton className="h-48" />;
  if (report.isError || !report.data) return <ErrorState error={report.error} />;

  return (
    <>
      <Card>
        <CardHeader
          title={report.data.title}
          action={
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  void navigator.clipboard?.writeText(report.data!.content ?? "");
                  toast.showToast({ variant: "success", title: "Report copied" });
                }}
              >
                <Copy size={11} />
                Copy
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setFollowUpOpen(true)}>
                <Plus size={11} />
                Follow-up task
              </Button>
              {task.data.type === "scout" && (
                <Button
                  variant="primary"
                  size="xs"
                  loading={promote.isPending}
                  onClick={() =>
                    promote.mutate(task.data!.id, {
                      onSuccess: (ship) => {
                        toast.showToast({
                          variant: "success",
                          title: `Promoted to ${ship.id}`,
                          description: ship.title,
                        });
                        navigate(`/tasks/${ship.id}`);
                      },
                      onError: (err) =>
                        toast.showToast({
                          variant: "error",
                          title: "Promotion failed",
                          description: err instanceof Error ? err.message : undefined,
                        }),
                    })
                  }
                >
                  <Sparkles size={11} />
                  Promote to ship
                </Button>
              )}
            </div>
          }
        />
        <div className="p-4">
          <MarkdownView content={report.data.content ?? report.data.summary ?? ""} />
        </div>
      </Card>
      <TaskCreateDialog
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        defaults={{
          projectId: task.data.projectId,
          title: `Follow-up: ${task.data.title}`,
          description: `Follow-up to ${task.data.id} (report ${report.data.id}).`,
          tags: task.data.tags,
        }}
      />
    </>
  );
}

function Detail({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-fg-subtle">{label}</span>
      <span className={`min-w-0 truncate text-right text-fg-muted ${mono ? "font-mono text-[11px]" : ""}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function DetailsTab({ taskId }: { taskId: string }) {
  const { task, agent, worktree, project } = useTaskLookup(taskId);
  if (task.isLoading || !task.data) return <Skeleton className="h-40" />;
  const t = task.data;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Metadata" />
        <div className="grid gap-x-8 gap-y-2.5 p-4 text-xs">
          <Detail label="Task ID" value={t.id} mono />
          <Detail label="Project" value={project.data?.name ?? t.projectId} />
          <Detail label="Type" value={`${t.type} / ${t.executionClass}`} />
          <Detail label="Status" value={t.status} />
          <Detail label="Attempts" value={String(t.attempts)} />
          <Detail label="Branch" value={t.branch} mono />
          <Detail label="Worktree" value={worktree?.path} mono />
          <Detail label="Report" value={t.reportId} mono />
          <Detail label="Created" value={formatRelativeTime(t.createdAt)} />
          <Detail label="Updated" value={formatRelativeTime(t.updatedAt)} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Worker" />
        <div className="grid gap-x-8 gap-y-2.5 p-4 text-xs">
          <Detail label="Agent" value={agent?.id} mono />
          <Detail label="Provider" value={agent?.provider} />
          <Detail label="Model" value={agent?.model} mono />
          <Detail label="Status" value={agent?.status} />
          <Detail label="Started" value={agent ? formatRelativeTime(agent.startedAt) : undefined} />
          <Detail label="Heartbeat" value={agent ? formatRelativeTime(agent.heartbeatAt) : undefined} />
          <Detail label="Tokens" value={formatTokens(agent?.tokenUsage)} />
          <Detail label="Cost" value={formatCost(agent?.costEstimate)} />
          <Detail label="Log path" value={agent?.logPath} mono />
        </div>
      </Card>
    </div>
  );
}

export function TaskDetailPage() {
  const { taskId = "" } = useParams();
  const { task, agent } = useTaskLookup(taskId);
  const [tab, setTab] = useState("chat");
  const [followUpOpen, setFollowUpOpen] = useState(false);

  if (task.isError) {
    return (
      <PageContainer title="Task">
        <ErrorState error={task.error} onRetry={() => void task.refetch()} />
      </PageContainer>
    );
  }

  const t = task.data;

  return (
    <PageContainer
      title={
        t ? (
          <span className="flex items-center gap-2.5">
            <Mono className="text-xs text-fg-subtle">{t.id}</Mono>
            <span className="text-base">{t.title}</span>
          </span>
        ) : (
          <Skeleton className="h-6 w-64" />
        )
      }
      subtitle={
        t && (
          <span className="flex flex-wrap items-center gap-2">
            <TypeBadge type={t.type} />
            <ClassBadge executionClass={t.executionClass} />
            <StatusBadge status={t.status} />
            {t.attempts > 0 && <Tag>attempt {t.attempts + 1}</Tag>}
            {agent && (
              <span className="text-fg-subtle">
                worker <span className="font-mono text-fg-muted">{agent.id}</span> ({agent.provider}/{agent.model})
              </span>
            )}
          </span>
        )
      }
      actions={
        t && (
          <>
            <LastUpdated query={task} />
            <Button variant="secondary" onClick={() => setFollowUpOpen(true)}>
              <Plus size={13} />
              Follow-up
            </Button>
            <TaskActionsMenu task={t} />
          </>
        )
      }
    >
      {t && t.description && (
        <p className="max-w-3xl text-xs leading-relaxed text-fg-muted">{t.description}</p>
      )}
      <Tabs
        items={[
          { id: "chat", label: "Chat / Logs" },
          { id: "progress", label: "Progress" },
          { id: "files", label: "Files" },
          { id: "commits", label: "Commits" },
          { id: "report", label: "Report" },
          { id: "details", label: "Details" },
        ]}
        activeId={tab}
        onChange={setTab}
      />
      {tab === "chat" && <TaskChatTab taskId={taskId} />}
      {tab === "progress" && <ProgressTab taskId={taskId} />}
      {tab === "files" && <FilesTab taskId={taskId} />}
      {tab === "commits" && <CommitsTab taskId={taskId} />}
      {tab === "report" && <ReportTab taskId={taskId} />}
      {tab === "details" && <DetailsTab taskId={taskId} />}

      <TaskCreateDialog
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        defaults={
          t
            ? {
                projectId: t.projectId,
                title: `Follow-up: ${t.title}`,
                description: `Follow-up to ${t.id}.`,
                tags: t.tags,
              }
            : undefined
        }
      />
    </PageContainer>
  );
}
