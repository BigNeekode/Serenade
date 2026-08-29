import { useState } from "react";
import { CircleCheck, CircleX, Loader2, Sparkles, Wrench } from "lucide-react";
import { toAppError, type EnvironmentStatus, type ToolStatus } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useUpdateConfig } from "@/hooks/use-config";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

function toolStateIcon(state: ToolStatus["state"]) {
  switch (state) {
    case "ready":
    case "installed":
      return <CircleCheck size={14} className="text-success" />;
    case "missing":
    case "incompatible":
    case "unhealthy":
    case "configuration-required":
    case "authentication-required":
      return <CircleX size={14} className="text-danger" />;
    case "installing":
      return <Loader2 size={14} className="animate-spin text-fg-muted" />;
    default:
      return <CircleX size={14} className="text-warning" />;
  }
}

function toolSummary(tool: ToolStatus) {
  const parts: string[] = [tool.label];
  if (tool.version) parts.push(`(${tool.version})`);
  if (tool.ownership) parts.push(`— ${tool.ownership}`);
  return parts.join(" ");
}

const INSTALLABLE = new Set(["hand", "treehouse", "herdr"]);

function toolNeedsInstall(tool: ToolStatus | undefined) {
  return !!tool && tool.state !== "ready" && tool.state !== "installed";
}

export function SetupScreen({
  env,
  onRevalidate,
}: {
  env: EnvironmentStatus;
  onRevalidate: () => void;
}) {
  const handTool = env.tools.find((t) => t.id === "hand");
  const fleet = env.fleet;
  const updateConfig = useUpdateConfig();
  const api = useApi();
  const toast = useToast();
  const [handPath, setHandPath] = useState(handTool?.path ?? "hand");
  const [fleetPath, setFleetPath] = useState(fleet.path ?? "");
  const [initBusy, setInitBusy] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);

  const handFound = handTool?.state === "ready";
  const fleetValid = fleet.state === "ready";

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
        description: toAppError(err).message,
      });
    } finally {
      setInitBusy(false);
    }
  };

  const installTool = async (toolId: string): Promise<boolean> => {
    setInstalling(toolId);
    try {
      let result: string;
      if (toolId === "hand") result = await api.installManagedHand();
      else if (toolId === "treehouse") result = await api.installTreehouse();
      else if (toolId === "herdr") result = await api.installHerdr();
      else return false;
      onRevalidate();
      toast.showToast({ variant: "success", title: `${toolId} installed`, description: result });
      return true;
    } catch (err) {
      toast.showToast({
        variant: "error",
        title: `${toolId} installation failed`,
        description: toAppError(err).message,
      });
      return false;
    } finally {
      setInstalling(null);
    }
  };

  const repairAutomatically = async () => {
    setRepairing(true);
    try {
      for (const tool of env.tools) {
        if (!INSTALLABLE.has(tool.id) || !toolNeedsInstall(tool)) continue;
        const ok = await installTool(tool.id);
        if (!ok) return; // stop on first failure; the toast already explains why
      }
    } finally {
      setRepairing(false);
    }
  };

  const repairable = env.tools.some((t) => INSTALLABLE.has(t.id) && toolNeedsInstall(t));

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
            {env.tools.map((tool) => (
              <div key={tool.id} className="flex items-center gap-2 text-xs">
                {toolStateIcon(tool.state)}
                <span className={tool.state === "ready" || tool.state === "installed" ? "text-fg-muted" : "text-danger"}>
                  {toolSummary(tool)}
                </span>
                {INSTALLABLE.has(tool.id) && toolNeedsInstall(tool) && (
                  <Button
                    variant="secondary"
                    size="xs"
                    className="ml-auto"
                    onClick={() => void installTool(tool.id)}
                    disabled={installing !== null || repairing}
                  >
                    {installing === tool.id ? <Loader2 size={11} className="animate-spin" /> : <Wrench size={11} />}
                    Install
                  </Button>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs">
              {fleetValid ? (
                <CircleCheck size={14} className="text-success" />
              ) : (
                <CircleX size={14} className="text-danger" />
              )}
              <span className={fleetValid ? "text-fg-muted" : "text-danger"}>
                {fleetValid ? `fleet valid (${fleet.path})` : "fleet missing or invalid"}
              </span>
            </div>
            {env.issues.map((issue) => (
              <p key={issue} className="pl-5 text-[11px] text-warning">
                {issue}
              </p>
            ))}
          </div>

          {repairable && (
            <Button
              variant="primary"
              size="md"
              className="mb-4 w-full"
              onClick={() => void repairAutomatically()}
              disabled={installing !== null || repairing}
            >
              {repairing || installing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Repair automatically (install missing tools)
            </Button>
          )}

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
            {handFound && !fleetValid && (
              <Button variant="secondary" size="md" className="w-full" onClick={initialize} disabled={initBusy}>
                {initBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                Initialize a fleet at this path (hand init)
              </Button>
            )}
            <Button variant="secondary" size="md" className="w-full" onClick={save} disabled={updateConfig.isPending}>
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
