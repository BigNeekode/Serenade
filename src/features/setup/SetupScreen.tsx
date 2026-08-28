import { useState } from "react";
import { CircleCheck, CircleX, Loader2, Sparkles } from "lucide-react";
import type { EnvironmentStatus } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useUpdateConfig } from "@/hooks/use-config";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

export function SetupScreen({
  env,
  onRevalidate,
}: {
  env: EnvironmentStatus;
  onRevalidate: () => void;
}) {
  const updateConfig = useUpdateConfig();
  const api = useApi();
  const toast = useToast();
  const [handPath, setHandPath] = useState(env.handPath ?? "hand");
  const [fleetPath, setFleetPath] = useState(env.fleetPath ?? "");
  const [initBusy, setInitBusy] = useState(false);

  const save = async () => {
    try {
      await updateConfig.mutateAsync({
        handBinaryPath: handPath.trim() || null,
        fleetPath: fleetPath.trim() || null,
      });
      onRevalidate();
      toast.showToast({ variant: "success", title: "Environment saved", description: "Re-validating fleet…" });
    } catch {
      toast.showToast({ variant: "error", title: "Could not save configuration" });
    }
  };

  const initialize = async () => {
    const path = fleetPath.trim();
    if (!path) {
      toast.showToast({ variant: "error", title: "Enter a fleet path first" });
      return;
    }
    setInitBusy(true);
    try {
      await api.initializeFleet(path);
      await updateConfig.mutateAsync({ fleetPath: path });
      onRevalidate();
      toast.showToast({ variant: "success", title: "Fleet initialized", description: path });
    } catch (err) {
      toast.showToast({
        variant: "error",
        title: "hand init failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setInitBusy(false);
    }
  };

  const statusRow = (ok: boolean, label: string) => (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <CircleCheck size={14} className="text-success" />
      ) : (
        <CircleX size={14} className="text-danger" />
      )}
      <span className={ok ? "text-fg-muted" : "text-danger"}>{label}</span>
    </div>
  );

  return (
    <div className="flex min-h-full items-center justify-center bg-base px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-fg">Welcome to Serenade</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
            A control interface for Secondhand (<span className="font-mono">hand</span>). Point Serenade at
            your <span className="font-mono">hand</span> binary and fleet to get started.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5">
          <div className="mb-4 space-y-1.5 rounded-lg bg-surface p-3">
            {statusRow(env.handFound, env.handFound ? `hand found (${env.handVersion ?? "version unknown"})` : "hand executable not found")}
            {statusRow(env.fleetValid, env.fleetValid ? `fleet valid (${env.fleetPath})` : "fleet missing or invalid")}
            {env.issues.map((issue) => (
              <p key={issue} className="pl-5 text-[11px] text-warning">
                {issue}
              </p>
            ))}
          </div>

          <div className="space-y-4">
            <Field label="hand binary path" hint="Executable name on PATH, or an absolute path.">
              <Input value={handPath} onChange={(e) => setHandPath(e.target.value)} placeholder="hand" />
            </Field>
            <Field label="Fleet path" hint="Directory of your hand fleet (run `hand init`, or use the button below).">
              <Input
                value={fleetPath}
                onChange={(e) => setFleetPath(e.target.value)}
                placeholder="e.g. C:\\dev\\hand-fleet"
              />
            </Field>
            {env.handFound && !env.fleetValid && (
              <Button variant="secondary" size="md" className="w-full" onClick={initialize} disabled={initBusy}>
                {initBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                Initialize a fleet at this path (hand init)
              </Button>
            )}
            <Button variant="primary" size="md" className="w-full" onClick={save} disabled={updateConfig.isPending}>
              {updateConfig.isPending && <Loader2 size={13} className="animate-spin" />}
              Save & validate
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-fg-subtle">
          Need help? See the <span className="font-mono">docs/</span> folder in the Serenade repository.
        </p>
      </div>
    </div>
  );
}
