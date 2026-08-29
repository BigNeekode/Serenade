import { useState } from "react";
import { CircleCheck, CircleX, Loader2, RotateCcw } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useApi } from "@/lib/api";
import { useEnvironment, useUpdateConfig } from "@/hooks/use-config";
import { compatibilityFromEnvironment } from "@/lib/hand/compatibility";
import { toAppError, type ToolStatus } from "@/types/domain";

function ToolCard({
  tool,
  onInstall,
  onCustomPath,
}: {
  tool: ToolStatus;
  onInstall?: () => void;
  onCustomPath?: () => void;
}) {
  const stateClass = {
    ready: "text-success",
    installed: "text-success",
    missing: "text-danger",
    incompatible: "text-danger",
    unhealthy: "text-danger",
    "configuration-required": "text-warning",
    "authentication-required": "text-warning",
    installing: "text-fg-muted",
  }[tool.state];

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {tool.state === "ready" || tool.state === "installed" ? (
            <CircleCheck size={14} className="text-success" />
          ) : (
            <CircleX size={14} className="text-danger" />
          )}
          <span className="text-xs font-medium text-fg">{tool.label}</span>
          {tool.required && <span className="text-[10px] text-danger">required</span>}
        </div>
        <span className={`text-[11px] capitalize ${stateClass}`}>{tool.state.replace(/-/g, " ")}</span>
      </div>
      <div className="mt-2 space-y-1 text-[11px] text-fg-muted">
        {tool.path && <div>Path: <span className="font-mono">{tool.path}</span></div>}
        {tool.version && <div>Version: {tool.version}</div>}
        {tool.ownership && <div>Ownership: {tool.ownership}</div>}
        {tool.message && <div className={tool.state === "ready" || tool.state === "installed" ? "text-fg-muted" : "text-warning"}>{tool.message}</div>}
        {tool.suggestedAction && <div className="text-fg-subtle">{tool.suggestedAction}</div>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {onInstall && (tool.state === "missing" || tool.state === "incompatible" || tool.state === "unhealthy") && (
          <Button variant="secondary" size="xs" onClick={onInstall}>
            Install / Reinstall
          </Button>
        )}
        {onCustomPath && (
          <Button variant="ghost" size="xs" onClick={onCustomPath}>
            Choose custom path
          </Button>
        )}
      </div>
    </div>
  );
}

export function EnvironmentSection({ onRevalidate }: { onRevalidate: () => void }) {
  const env = useEnvironment();
  const updateConfig = useUpdateConfig();
  const api = useApi();
  const toast = useToast();
  const [customPath, setCustomPath] = useState("");
  const [showCustomPath, setShowCustomPath] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

  const data = env.data;
  const compatibility = data ? compatibilityFromEnvironment(data) : undefined;

  const handleRescan = () => onRevalidate();

  const handleInstall = async (toolId: string, label: string) => {
    setInstalling(toolId);
    try {
      let result: string;
      if (toolId === "hand") result = await api.installManagedHand();
      else if (toolId === "treehouse") result = await api.installTreehouse();
      else if (toolId === "herdr") result = await api.installHerdr();
      else throw new Error(`No installer for ${toolId}`);
      toast.showToast({ variant: "success", title: `${label} installed`, description: result });
      onRevalidate();
    } catch (err) {
      toast.showToast({
        variant: "error",
        title: `${label} installation failed`,
        description: toAppError(err).message,
      });
    } finally {
      setInstalling(null);
    }
  };

  const handleSetCustomHand = async () => {
    if (!customPath.trim()) return;
    try {
      await updateConfig.mutateAsync({ handBinaryPath: customPath.trim() });
      setShowCustomPath(false);
      setCustomPath("");
      onRevalidate();
      toast.showToast({ variant: "success", title: "Custom Hand path saved" });
    } catch {
      toast.showToast({ variant: "error", title: "Could not save custom path" });
    }
  };

  return (
    <Card>
      <CardHeader
        title="Environment"
        action={
          <Button variant="secondary" size="xs" onClick={handleRescan} disabled={env.isRefetching}>
            {env.isRefetching ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
            Rescan
          </Button>
        }
      />
      <div className="space-y-4 p-4">
        <div className="text-xs text-fg-muted">
          Platform: {data?.platform.os} · {data?.platform.arch}
        </div>

        {data?.tools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            onInstall={
              ["hand", "treehouse", "herdr"].includes(tool.id)
                ? () => handleInstall(tool.id, tool.label)
                : undefined
            }
            onCustomPath={tool.id === "hand" ? () => setShowCustomPath((s) => !s) : undefined}
          />
        ))}

        {showCustomPath && (
          <div className="space-y-2 rounded-lg bg-surface p-3">
            <Field label="Custom hand executable path">
              <Input
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="C:\\tools\\hand\\hand.exe"
              />
            </Field>
            <div className="flex gap-2">
              <Button variant="primary" size="xs" onClick={handleSetCustomHand} disabled={updateConfig.isPending}>
                Save
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setShowCustomPath(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-line bg-surface p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-fg">Fleet</span>
            <span
              className={`text-[11px] capitalize ${
                data?.fleet.state === "ready" ? "text-success" : "text-danger"
              }`}
            >
              {data?.fleet.state.replace(/-/g, " ")}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-[11px] text-fg-muted">
            {data?.fleet.path && <div>Path: <span className="font-mono">{data.fleet.path}</span></div>}
            {data?.fleet.message && <div>{data.fleet.message}</div>}
          </div>
        </div>

        {compatibility && (
          <p
            className={`text-[11px] ${
              compatibility.mode === "supported"
                ? "text-success"
                : compatibility.mode === "warning"
                  ? "text-warning"
                  : "text-danger"
            }`}
          >
            Hand contract: {compatibility.contract} · {compatibility.reason}
          </p>
        )}

        {installing && (
          <div className="flex items-center gap-2 text-[11px] text-fg-muted">
            <Loader2 size={12} className="animate-spin" />
            Installing {installing}…
          </div>
        )}
      </div>
    </Card>
  );
}
