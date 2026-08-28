import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useProjects } from "@/hooks/use-projects";
import { useCreateTask } from "@/hooks/use-tasks";
import { useUiStore } from "@/state/ui-store";
import type { CreateTaskInput, ExecutionClass, TaskType } from "@/types/domain";
import { validateCreateTaskInput } from "@/lib/validation";

/**
 * The form mounts fresh each time the dialog opens, so defaults apply cleanly
 * without effect-driven state resets.
 */
export function TaskCreateDialog({
  open,
  onClose,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  defaults?: Partial<CreateTaskInput>;
}) {
  if (!open) return null;
  return <TaskCreateForm onClose={onClose} defaults={defaults} />;
}

function TaskCreateForm({
  onClose,
  defaults,
}: {
  onClose: () => void;
  defaults?: Partial<CreateTaskInput>;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: projects } = useProjects();
  const createTask = useCreateTask();
  const { selectedProjectId } = useUiStore();

  const [projectId, setProjectId] = useState(
    () => defaults?.projectId ?? selectedProjectId ?? projects?.[0]?.id ?? "",
  );
  const [title, setTitle] = useState(() => defaults?.title ?? "");
  const [description, setDescription] = useState(() => defaults?.description ?? "");
  const [type, setType] = useState<TaskType>(() => defaults?.type ?? "ship");
  const [executionClass, setExecutionClass] = useState<ExecutionClass>(
    () => defaults?.executionClass ?? "standard",
  );
  const [tags, setTags] = useState(() => (defaults?.tags ?? []).join(", "));
  const [errors, setErrors] = useState<string[]>([]);

  const submit = async () => {
    const input: CreateTaskInput = {
      projectId,
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      executionClass,
      tags: tags
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean),
    };
    const validation = validateCreateTaskInput(input);
    setErrors(validation);
    if (validation.length > 0) return;
    try {
      const task = await createTask.mutateAsync(input);
      toast.showToast({ variant: "success", title: `Task ${task.id} created`, description: task.title });
      onClose();
      navigate(`/tasks/${task.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrors([message]);
      toast.showToast({ variant: "error", title: "Could not create task", description: message });
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="New Task"
      description="Creates the task brief and dispatches a worker immediately (hand spawn)."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={createTask.isPending}>
            <Plus size={13} />
            Create task
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Project">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Add cursor pagination to /users"
            autoFocus
          />
        </Field>
        <Field label="Description (optional)">
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Context, constraints, acceptance criteria…"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as TaskType)}>
              <option value="scout">scout — investigate, deliverable is a report</option>
              <option value="ship">ship — implement, deliverable is a PR</option>
            </Select>
          </Field>
          <Field label="Execution class">
            <Select
              value={executionClass}
              onChange={(e) => setExecutionClass(e.target.value as ExecutionClass)}
            >
              <option value="mechanical">mechanical</option>
              <option value="standard">standard</option>
              <option value="deep">deep</option>
            </Select>
          </Field>
        </div>
        <Field label="Tags (optional)" hint="Comma separated.">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="api, perf" />
        </Field>
        {errors.length > 0 && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2">
            {errors.map((err) => (
              <p key={err} className="text-xs text-danger">
                {err}
              </p>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
