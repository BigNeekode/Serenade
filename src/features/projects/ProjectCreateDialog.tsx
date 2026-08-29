import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAddProject } from "@/hooks/use-projects";
import { toAppError } from "@/types/domain";

const URL_PATTERN = /^(https:\/\/|git@|ssh:\/\/|git:\/\/)/;

/**
 * Register a project through Hand 0.6's canonical contract (`hand project add`).
 * Hand 0.6 only accepts remote Git sources; `create` and local-path adoption
 * are 0.8 contracts and are intentionally not offered here. Serenade does not
 * own the registered-project source of truth.
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

  const [url, setUrl] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const submit = async () => {
    const next: string[] = [];
    const trimmed = url.trim();
    if (!trimmed) {
      next.push("Enter a Git repository URL.");
    } else if (!URL_PATTERN.test(trimmed)) {
      next.push("Hand 0.6 only accepts remote URLs (https://, git@, ssh://, git://).");
    }
    setErrors(next);
    if (next.length > 0) return;

    try {
      await addProject.mutateAsync(trimmed);
      toast.showToast({ variant: "success", title: "Project added", description: trimmed });
      onClose();
    } catch (err) {
      const message = toAppError(err).message;
      setErrors([message]);
      toast.showToast({ variant: "error", title: "Could not register project", description: message });
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="New Project"
      description="Register a remote Git repository with your Hand fleet. Hand 0.6 clones the repo and registers it."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={addProject.isPending}>
            <Plus size={13} />
            Add project
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Repository URL" hint="e.g. https://github.com/you/repo or git@github.com:you/repo.git">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/you/repo"
            autoFocus
          />
        </Field>

        <p className="rounded-lg border border-line bg-surface p-3 text-[11px] leading-relaxed text-fg-subtle">
          Creating a brand-new repository is done on your Git remote first. Hand 0.6 then registers it here
          by cloning the URL. You can keep work local by choosing the{" "}
          <span className="font-mono">local-only</span> delivery mode.
        </p>

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
