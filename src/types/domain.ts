// Serenade domain model — mirrors docs/design.md §23.

export type ProjectStatus = "active" | "paused" | "unknown";

export interface Project {
  id: string;
  name: string;
  repoPath?: string;
  repoUrl?: string;
  status: ProjectStatus;
  defaultBranch?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type TaskType = "scout" | "ship";
export type ExecutionClass = "mechanical" | "standard" | "deep";

export type TaskStatus =
  | "backlog"
  | "queued"
  | "scouting"
  | "ready"
  | "in_progress"
  | "review"
  | "done"
  | "blocked"
  | "failed"
  | "stopped";

export interface PlanProjection {
  id: string;
  state?: string;
}

export interface AttemptProjection {
  ordinal: number;
  lifecycle?: string;
  harness?: string;
  model?: string;
}

/**
 * Progressive-disclosure lineage. Legacy Hand can expose real Attempt facts but
 * has no canonical v19 Plan projection; missing `plan` means unavailable, not
 * inferred. `canonical` is reserved for the released Hand 0.8 adapter.
 */
export interface TaskLineage {
  source: "legacy" | "canonical";
  plan?: PlanProjection;
  activeAttempt?: AttemptProjection;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  type: TaskType;
  executionClass: ExecutionClass;
  status: TaskStatus;
  tags: string[];
  assignedAgentId?: string;
  worktreeId?: string;
  reportId?: string;
  branch?: string;
  progress?: number;
  attempts: number;
  lineage?: TaskLineage;
  createdAt: string;
  updatedAt: string;
}

export type AgentStatus =
  | "starting"
  | "running"
  | "waiting"
  | "blocked"
  | "completed"
  | "failed"
  | "stopped"
  | "unknown";

export interface AgentRun {
  id: string;
  taskId?: string;
  projectId?: string;
  provider: string;
  model?: string;
  status: AgentStatus;
  branch?: string;
  progress?: number;
  startedAt?: string;
  endedAt?: string;
  heartbeatAt?: string;
  tokenUsage?: number;
  costEstimate?: number;
  logPath?: string;
}

export type WorktreeGitStatus = "clean" | "dirty" | "ahead" | "diverged" | "unknown";
export type WorktreeState = "active" | "idle" | "orphaned" | "ready-for-review";

export interface Worktree {
  id: string;
  projectId: string;
  taskId?: string;
  agentId?: string;
  path: string;
  branch: string;
  gitStatus?: WorktreeGitStatus;
  changedFiles?: number;
  aheadBehind?: [number, number];
  lastCommit?: string;
  state: WorktreeState;
  createdAt?: string;
}

export type ReportKind =
  | "scout_report"
  | "run_summary"
  | "failure_summary"
  | "postmortem"
  | "learning"
  | "operator_note";

export interface Report {
  id: string;
  taskId: string;
  projectId: string;
  kind: ReportKind;
  title: string;
  path?: string;
  summary?: string;
  content?: string;
  createdAt?: string;
}

export interface Provider {
  id: string;
  name: string;
  enabled: boolean;
  connected: boolean;
  defaultModel?: string;
  activeWorkers: number;
  tasksCompleted: number;
  recentError?: string;
}

export interface RouteRule {
  id: string;
  taskType: TaskType | null;
  executionClass: ExecutionClass | null;
  providerId: string;
  model: string;
  priority: number;
  enabled: boolean;
  fallback?: boolean;
}

export type FleetEventSeverity = "info" | "success" | "warning" | "error";

export interface FleetEvent {
  id: string;
  kind: string;
  message: string;
  projectId?: string;
  taskId?: string;
  agentId?: string;
  severity: FleetEventSeverity;
  createdAt: string;
}

export type PreferredEditor = "vscode" | "cursor" | "zed" | "custom";

/**
 * Supervisor Harness is intentionally separate from Worker routes/profiles.
 * Only OpenCode is live-qualified in Serenade today; additional values should
 * be added only when their headless/session invocation contract is verified.
 */
export type SupervisorHarness = "opencode";

export interface AppConfig {
  handBinaryPath: string | null;
  fleetPath: string | null;
  /** Optional for backward compatibility with existing mock/saved GUI config. */
  supervisorHarness?: SupervisorHarness;
  preferredEditor: PreferredEditor;
  customEditorPath?: string | null;
  refreshProfile: "slow" | "default" | "fast";
  appearance: "dark" | "light" | "system";
  density: "comfortable" | "compact";
  reducedMotion: boolean;
  notifications: {
    workerFailed: boolean;
    taskCompleted: boolean;
    reportReady: boolean;
    approvalRequired: boolean;
  };
  /** True once the first-run wizard has been completed. Used as a UX hint only; actual readiness is always derived from scans. */
  setupCompleted: boolean;
}

export type ToolOwnership = "managed" | "system" | "custom";

export type ToolState =
  | "missing"
  | "installing"
  | "installed"
  | "configuration-required"
  | "authentication-required"
  | "incompatible"
  | "unhealthy"
  | "ready";

export interface ToolStatus {
  id: string;
  label: string;
  required: boolean;
  ownership?: ToolOwnership;
  path?: string;
  version?: string;
  state: ToolState;
  compatible?: boolean;
  message?: string;
  suggestedAction?: string;
  capabilities: string[];
}

export interface FleetHealth {
  path?: string;
  state: ToolState;
  message?: string;
}

export interface EnvironmentPlatform {
  os: string;
  arch: string;
}

export interface EnvironmentStatus {
  platform: EnvironmentPlatform;
  tools: ToolStatus[];
  fleet: FleetHealth;
  ready: boolean;
  issues: string[];
  setupCompleted?: boolean;
}

export interface HandCapabilities {
  supportsStructuredTaskOutput: boolean;
  supportsPause: boolean;
  supportsRouteWrite: boolean;
  supportsTaskMessage: boolean;
  supportsReportListing: boolean;
}

export interface Diagnostics {
  appVersion: string;
  mode: "mock" | "tauri";
  tauriVersion?: string;
  handPath?: string;
  handVersion?: string;
  fleetPath?: string;
  fleetValid?: boolean;
  capabilities: HandCapabilities;
  recentErrors: string[];
}

export type LogSource = "supervisor" | "worker" | "system";
export type LogLevel = "info" | "warn" | "error" | "success";

export interface LogLine {
  id: string;
  ts: string;
  source: LogSource;
  level: LogLevel;
  message: string;
}

export interface LogChunkRequest {
  taskId: string;
  cursor?: string;
  limit?: number;
}

export interface LogChunkResponse {
  lines: LogLine[];
  nextCursor?: string;
}

export interface SupervisorReply {
  text: string;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  type: TaskType;
  executionClass: ExecutionClass;
  tags?: string[];
  sourceTaskId?: string;
  sourceReportId?: string;
}

// Structured error model — architecture.md §17.
export type SerenadeErrorCode =
  | "HAND_NOT_FOUND"
  | "INVALID_FLEET"
  | "PROJECT_NOT_FOUND"
  | "TASK_NOT_FOUND"
  | "WORKTREE_NOT_FOUND"
  | "COMMAND_FAILED"
  | "PARSE_FAILED"
  | "PERMISSION_DENIED"
  | "UNSUPPORTED_CAPABILITY"
  | "GIT_FAILED"
  | "INVALID_PATH"
  | "NOT_FOUND";

export interface AppError {
  code: SerenadeErrorCode;
  title: string;
  message: string;
  detail?: string;
  recoverable: boolean;
  suggestedAction?: string;
}

export function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err;
  return {
    code: "COMMAND_FAILED",
    title: "Unexpected error",
    message: err instanceof Error ? err.message : String(err),
    recoverable: true,
  };
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "title" in value &&
    "message" in value
  );
}

export class SerenadeApiError extends Error implements AppError {
  code: SerenadeErrorCode;
  title: string;
  message: string;
  detail?: string;
  recoverable: boolean;
  suggestedAction?: string;

  constructor(err: AppError) {
    super(err.message);
    this.name = "SerenadeApiError";
    this.code = err.code;
    this.title = err.title;
    this.message = err.message;
    this.detail = err.detail;
    this.recoverable = err.recoverable;
    this.suggestedAction = err.suggestedAction;
  }
}
