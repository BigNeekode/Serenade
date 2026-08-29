import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAddProject, useCreateProject } from "@/hooks/use-projects";
import { toAppError } from "@/types/domain";

type InputMode = "url" | "local" | "create";

/**
 * Register or create a project through Hand's canonical contract
 * (`hand project add` / `hand project create`). Serenade does not own the
 * registered-project source of truth; it only invokes Hand and refreshes.
 */
export function ProjectCreateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return <ProjectCreateForm onClose={onClose} />;
}

function ProjectCreateForm({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const addProject = useAddProject();
  const createProject = useCreateProject();

  const [mode, setMode] = useState<InputMode>("url");
  const [url, setUrl] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const pending = addProject.isPending || createProject.isPending;

  const submit = async () => {
    const errors: string[] = [];
    if (mode === "url" && !url.trim()) errors.push("Enter a Git repository URL.");
    if (mode === "local" && !localPath.trim()) errors.push("Enter a local repository path.");
    if (mode === "create" && !name.trim()) errors.push("Enter a project name.");
    setErrors(errors);
    if (errors.length > 0) return;

    try {
      if (mode === "url") {
        await addProject.mutateAsync(url.trim());
        toast.showToast({ variant: "success", title: "Project added", description: url.trim() });
      } else if (mode === "local") {
        await addProject.mutateAsync(localPath.trim());
        toast.showToast({ variant: "success", title: "Project added", description: localPath.trim() });
      } else {
        await createProject.mutateAsync(name.trim());
        toast.showToast({ variant: "success", title: "Project created", description: name.trim() });
      }
      onClose();
    } catch (err) {
      const message = toAppError(err).message;
      setErrors([message]);
      toast.showToast({ variant: "error", title: "Could not register project", description: message });
    }
  };

  const modeOption = (value: InputMode, label: string, hint: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(value);
        setErrors([]);
      }}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        mode === value ? "border-accent/60 bg-accent/5" : "border-line bg-surface hover:border-line-strong"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-3.5 w-3.5 rounded-full border ${
            mode === value ? "border-accent bg-accent" : "border-line-strong"
          }`}
        />
        <span className="text-xs font-medium text-fg">{label}</span>
      </div>
      <p className="mt-1 pl-5 text-[11px] leading-relaxed text-fg-muted">{hint}</p>
    </button>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title="New Project"
      description="Register or create a project through Hand. Remote and local sources are cloned under the Fleet home."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={pending}>
            <Plus size={13} />
            {mode === "create" ? "Create project" : "Add project"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {modeOption("url", "Git repository URL", "Clone a remote repository, e.g. https://github.com/you/repo or git@github.com:you/repo.git.")}
        {modeOption("local", "Existing local repository", "Adopt a local Git checkout. Hand copies committed state into a Fleet-managed clone and leaves the source untouched.")}
        {modeOption("create", "Create a new project", "Create an empty local-only Git-backed project with one baseline commit.")}

        {mode === "url" && (
          <Field label="Repository URL">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/you/repo"
              autoFocus
            />
          </Field>
        )}
        {mode === "local" && (
          <Field label="Local repository path">
            <Input
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              placeholder="C:\\dev\\my-project"
              autoFocus
            />
          </Field>
        )}
        {mode === "create" && (
          <Field label="Project name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="new-project"
              autoFocus
            />
          </Field>
        )}

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
