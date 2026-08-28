import { invoke } from "@tauri-apps/api/core";
import type {
  AgentRun,
  AppConfig,
  CreateTaskInput,
  Diagnostics,
  EnvironmentStatus,
  FleetEvent,
  LogChunkRequest,
  LogChunkResponse,
  Project,
  Provider,
  Report,
  RouteRule,
  Task,
  Worktree,
} from "@/types/domain";
import type { SerenadeApi } from "./interface";

/**
 * Tauri-backed implementation of SerenadeApi.
 *
 * Command names mirror architecture.md §7. The Rust backend is not wired up yet
 * (no Rust toolchain / `hand` binary in the current environment — see
 * docs/hand-integration-notes.md); this adapter is the drop-in point when it is.
 *
 * Safety: every command receives typed, validated arguments. There is no
 * generic shell passthrough (architecture.md §11).
 */
export class TauriSerenadeApi implements SerenadeApi {
  async getConfig(): Promise<AppConfig> {
    return invoke("config_get");
  }
  async updateConfig(input: Partial<AppConfig>): Promise<AppConfig> {
    return invoke("config_update", { input });
  }
  async validateEnvironment(): Promise<EnvironmentStatus> {
    return invoke("environment_validate");
  }
  async getDiagnostics(): Promise<Diagnostics> {
    return invoke("diagnostics_get");
  }

  async listProjects(): Promise<Project[]> {
    return invoke("projects_list");
  }
  async getProject(projectId: string): Promise<Project> {
    return invoke("project_get", { projectId });
  }

  async listTasks(projectId?: string): Promise<Task[]> {
    return invoke("tasks_list", { projectId: projectId ?? null });
  }
  async getTask(taskId: string): Promise<Task> {
    return invoke("task_get", { taskId });
  }

  async listAgents(): Promise<AgentRun[]> {
    return invoke("agents_list");
  }
  async listWorktrees(projectId?: string): Promise<Worktree[]> {
    return invoke("worktrees_list", { projectId: projectId ?? null });
  }
  async listReports(projectId?: string): Promise<Report[]> {
    return invoke("reports_list", { projectId: projectId ?? null });
  }
  async getReport(reportId: string): Promise<Report> {
    return invoke("report_get", { reportId });
  }
  async listRoutes(): Promise<{ providers: Provider[]; routes: RouteRule[] }> {
    return invoke("routes_list");
  }
  async listEvents(limit?: number): Promise<FleetEvent[]> {
    return invoke("events_recent", { limit: limit ?? null });
  }
  async readTaskLogs(request: LogChunkRequest): Promise<LogChunkResponse> {
    return invoke("task_logs_read", { request });
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    return invoke("task_create", { input });
  }
  async sendTaskMessage(taskId: string, message: string): Promise<void> {
    return invoke("task_send_message", { taskId, message });
  }
  async retryTask(taskId: string): Promise<void> {
    return invoke("task_retry", { taskId });
  }
  async stopTask(taskId: string): Promise<void> {
    return invoke("task_stop", { taskId });
  }
  async promoteTask(taskId: string): Promise<Task> {
    return invoke("task_promote", { taskId });
  }

  async cleanupWorktree(worktreeId: string): Promise<void> {
    return invoke("worktree_cleanup", { worktreeId });
  }
  async openWorktree(
    worktreeId: string,
    target: "editor" | "folder" | "terminal",
  ): Promise<void> {
    return invoke(`worktree_open_${target}`, { worktreeId });
  }
}
