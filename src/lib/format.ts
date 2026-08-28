import type { ExecutionClass, TaskStatus, TaskType } from "@/types/domain";

export function formatRelativeTime(iso?: string, now: Date = new Date()): string {
  if (!iso) return "—";
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDuration(fromIso?: string, toIso?: string, now: Date = new Date()): string {
  if (!fromIso) return "—";
  const end = toIso ? new Date(toIso).getTime() : now.getTime();
  const s = Math.max(0, Math.floor((end - new Date(fromIso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function formatTimestamp(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatTokens(n?: number): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatCost(n?: number): string {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

export function formatPercent(n?: number): string {
  if (n == null) return "—";
  return `${Math.round(n)}%`;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  queued: "Queued",
  scouting: "Scouting",
  ready: "Ready to Ship",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
  failed: "Failed",
  stopped: "Stopped",
};

export function taskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status] ?? status;
}

export const EXECUTION_CLASS_LABELS: Record<ExecutionClass, string> = {
  mechanical: "mechanical",
  standard: "standard",
  deep: "deep",
};

export function taskTypeLabel(type: TaskType): string {
  return type === "scout" ? "SCOUT" : "SHIP";
}

export function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}
