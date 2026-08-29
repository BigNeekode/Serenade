import type {
  AppConfig,
  AgentRun,
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

/**
 * The single frontend API surface (architecture.md §5).
 * Implementations: MockSerenadeApi (UI development) and TauriSerenadeApi (real backend).
 * Screens must never import mock data directly.
 */
export interface SerenadeApi {
  // Config & environment
  getConfig(): Promise<AppConfig>;
  updateConfig(input: Partial<AppConfig>): Promise<AppConfig>;
  validateEnvironment(): Promise<EnvironmentStatus>;
  getDiagnostics(): Promise<Diagnostics>;
  initializeFleet(path: string, force?: boolean): Promise<void>;
  installManagedHand(): Promise<string>;
  installTreehouse(): Promise<string>;
  installHerdr(): Promise<string>;
  startHerdrServer(): Promise<void>;

  // Reads
  listProjects(): Promise<Project[]>;
  getProject(projectId: string): Promise<Project>;
  addProject(source: string): Promise<void>;
  listTasks(projectId?: string): Promise<Task[]>;
  getTask(taskId: string): Promise<Task>;
  listAgents(): Promise<AgentRun[]>;
  listWorktrees(projectId?: string): Promise<Worktree[]>;
  listReports(projectId?: string): Promise<Report[]>;
  getReport(reportId: string): Promise<Report>;
  listRoutes(): Promise<{ providers: Provider[]; routes: RouteRule[] }>;
  listEvents(limit?: number): Promise<FleetEvent[]>;
  readTaskLogs(request: LogChunkRequest): Promise<LogChunkResponse>;

  // Mutations
  createTask(input: CreateTaskInput): Promise<Task>;
  sendTaskMessage(taskId: string, message: string): Promise<void>;
  retryTask(taskId: string): Promise<void>;
  stopTask(taskId: string): Promise<void>;
  promoteTask(taskId: string): Promise<Task>;

  // Local tooling
  cleanupWorktree(worktreeId: string): Promise<void>;
  openWorktree(worktreeId: string, target: "editor" | "folder" | "terminal"): Promise<void>;

  // Supervisor chat
  supervisorChat(message: string, projectId?: string): Promise<SupervisorReply>;
  supervisorReset(projectId?: string): Promise<void>;
}
