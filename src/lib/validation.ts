import type { ExecutionClass, TaskType } from "@/types/domain";

/** IDs are restricted to a conservative charset before reaching the backend (architecture.md §11). */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidId(id: string): boolean {
  return ID_PATTERN.test(id);
}

export function isValidTaskTitle(title: string): boolean {
  const trimmed = title.trim();
  return trimmed.length >= 3 && trimmed.length <= 200;
}

export function isValidPath(path: string): boolean {
  const trimmed = path.trim();
  return trimmed.length > 0 && trimmed.length <= 1024 && !trimmed.includes("\0");
}

export function validateCreateTaskInput(input: {
  projectId: string;
  title: string;
  type: TaskType;
  executionClass: ExecutionClass;
}): string[] {
  const errors: string[] = [];
  if (!isValidId(input.projectId)) errors.push("A project must be selected.");
  if (!isValidTaskTitle(input.title)) errors.push("Title must be 3–200 characters.");
  if (input.type !== "scout" && input.type !== "ship") errors.push("Task type must be scout or ship.");
  if (!["mechanical", "standard", "deep"].includes(input.executionClass))
    errors.push("Execution class must be mechanical, standard, or deep.");
  return errors;
}
