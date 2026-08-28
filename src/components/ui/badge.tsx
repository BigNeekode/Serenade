import type { ReactNode } from "react";
import clsx from "clsx";
import type { AgentStatus, TaskStatus, WorktreeGitStatus } from "@/types/domain";
import { taskTypeLabel } from "@/lib/format";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-raised text-fg-muted border-line",
  accent: "bg-accent-soft text-accent border-accent/30",
  success: "bg-success-soft text-success border-success/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  info: "bg-info-soft text-info border-info/30",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded bg-raised px-1.5 py-0.5 text-[10px] text-fg-muted border border-line">
      #{children}
    </span>
  );
}

export function Mono({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={clsx("font-mono text-xs text-fg-muted", className)}>{children}</span>
  );
}

const taskStatusTones: Record<TaskStatus, Tone> = {
  backlog: "neutral",
  queued: "info",
  scouting: "info",
  ready: "accent",
  in_progress: "success",
  review: "accent",
  done: "success",
  blocked: "warning",
  failed: "danger",
  stopped: "warning",
};

const agentStatusTones: Record<AgentStatus, Tone> = {
  starting: "info",
  running: "success",
  waiting: "info",
  blocked: "warning",
  completed: "success",
  failed: "danger",
  stopped: "warning",
  unknown: "neutral",
};

const gitStatusTones: Record<WorktreeGitStatus, Tone> = {
  clean: "success",
  dirty: "warning",
  ahead: "info",
  diverged: "danger",
  unknown: "neutral",
};

export function StatusBadge({ status, kind = "task" }: { status: string; kind?: "task" | "agent" | "git" }) {
  const tone =
    kind === "agent"
      ? (agentStatusTones[status as AgentStatus] ?? "neutral")
      : kind === "git"
        ? (gitStatusTones[status as WorktreeGitStatus] ?? "neutral")
        : (taskStatusTones[status as TaskStatus] ?? "neutral");
  return <Badge tone={tone}>{status.replaceAll("_", " ")}</Badge>;
}

export function TypeBadge({ type }: { type: "scout" | "ship" }) {
  return (
    <Badge tone={type === "scout" ? "info" : "accent"}>{taskTypeLabel(type)}</Badge>
  );
}

export function ClassBadge({ executionClass }: { executionClass: string }) {
  return <Badge tone="neutral">{executionClass}</Badge>;
}

export function ProviderBadge({ provider }: { provider: string }) {
  const tone: Tone =
    provider === "anthropic" ? "accent" : provider === "openai" ? "success" : provider === "google" ? "info" : "neutral";
  return <Badge tone={tone}>{provider}</Badge>;
}
