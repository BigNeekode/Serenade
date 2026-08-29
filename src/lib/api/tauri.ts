import { invoke } from "@tauri-apps/api/core";
import { HandGateway } from "@/lib/hand/gateway";
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
  SupervisorReply,
  Task,
  Worktree,
} from "@/types/domain";
import type { SerenadeApi } from "./interface";

/**
 * Tauri-backed implementation of SerenadeApi.
 *
 * React features depend on Serenade domain contracts, while Hand contract
 * negotiation is centralized in HandGateway. The current backend remains the
 * verified 0.6/0.7 adapter; Hand 0.8+ stays read/diagnostics-only until its
 * released projection/action contracts are integrated.
 *
 * Safety: every command receives typed, validated arguments. There is no
 * generic shell passthrough (architecture.md §11).
 */
export class TauriSerenadeApi implements SerenadeApi {
  private readonly hand = new HandGateway();

  async getConfig(): Promise<AppConfig> {
    return invoke("config_get");
  }
  async updateConfig(input: Partial<AppConfig>): Promise<AppConfig> {
    return invoke("config_update", { input });
  }
  async validateEnvironment(): Promise<EnvironmentStatus> {
    return this.hand.environment();
  }
  async getDiagnostics(): Promise<Diagnostics> {
    return invoke("diagnostics_get");
  }
  async initializeFleet(path: string, force?: boolean): Promise<void> {
    return invoke("fleet_init", { path, force: force ?? false });
  }
  async installManagedHand(): Promise<string> {
    return invoke("install_managed_hand");
  }
  async installTreehouse(): Promise<string> {
    return invoke("install_treehouse");
  }
  async installHerdr(): Promise<string> {
    return invoke("install_herdr");
  }

  async listProjects(): Promise<Project[]> {
    return invoke("projects_list");
  }
  async getProject(projectId: string): Promise<Project> {
    return invoke("project_get", { projectId });
  }
  async addProject(source: string): Promise<void> {
    await this.hand.assertMutationCompatible();
    return invoke("project_add", { source });
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
    await this.hand.assertMutationCompatible();
    return invoke("task_create", { input });
  }
  async sendTaskMessage(taskId: string, message: string): Promise<void> {
    await this.hand.assertMutationCompatible();
    return invoke("task_send_message", { taskId, message });
  }
  async retryTask(taskId: string): Promise<void> {
    await this.hand.assertMutationCompatible();
    return invoke("task_retry", { taskId });
  }
  async stopTask(taskId: string): Promise<void> {
    await this.hand.assertMutationCompatible();
    return invoke("task_stop", { taskId });
  }
  async promoteTask(taskId: string): Promise<Task> {
    await this.hand.assertMutationCompatible();
    return invoke("task_promote", { taskId });
  }

  async cleanupWorktree(worktreeId: string): Promise<void> {
    await this.hand.assertMutationCompatible();
    return invoke("worktree_cleanup", { worktreeId });
  }
  async openWorktree(
    worktreeId: string,
    target: "editor" | "folder" | "terminal",
  ): Promise<void> {
    return invoke(`worktree_open_${target}`, { worktreeId });
  }

  async supervisorChat(message: string, projectId?: string): Promise<SupervisorReply> {
    return invoke("supervisor_chat", { message, projectId: projectId ?? null });
  }
  async supervisorReset(projectId?: string): Promise<void> {
    return invoke("supervisor_reset", { projectId: projectId ?? null });
  }
}
