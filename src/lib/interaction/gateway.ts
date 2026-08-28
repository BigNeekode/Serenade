import type { SerenadeApi } from "@/lib/api/interface";
import type { CreateTaskInput, SupervisorReply, Task } from "@/types/domain";

/**
 * Operator interaction boundary.
 *
 * Reasoning-required prose goes to the Supervisor Harness. Already-exact UI
 * actions call the canonical Hand mutation adapter directly and never spend a
 * supervisor/LLM turn merely translating a button click.
 *
 * This is deliberately a thin Serenade-side router today. Hand 0.8 can replace
 * the exact-action implementation/currentness payloads without changing the
 * presentation-facing distinction.
 */
export class InteractionGateway {
  constructor(private readonly api: SerenadeApi) {}

  // Path A: reasoning-required operator input.
  sendReasoningInput(message: string, projectId?: string): Promise<SupervisorReply> {
    return this.api.supervisorChat(message, projectId);
  }

  // Path B: already-exact typed operator actions.
  createTask(input: CreateTaskInput): Promise<Task> {
    return this.api.createTask(input);
  }

  sendTaskMessage(taskId: string, message: string): Promise<void> {
    return this.api.sendTaskMessage(taskId, message);
  }

  retryTask(taskId: string): Promise<void> {
    return this.api.retryTask(taskId);
  }

  stopTask(taskId: string): Promise<void> {
    return this.api.stopTask(taskId);
  }

  promoteTask(taskId: string): Promise<Task> {
    return this.api.promoteTask(taskId);
  }

  cleanupWorktree(worktreeId: string): Promise<void> {
    return this.api.cleanupWorktree(worktreeId);
  }
}
