import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleX, Copy } from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  useAppConfig,
  useUpdateConfig,
  useEnvironment,
  useDiagnostics,
} from "@/hooks/use-config";
import { EnvironmentSection } from "./EnvironmentSection";
import { compatibilityFromEnvironment } from "@/lib/hand/compatibility";
import type { AppConfig } from "@/types/domain";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const config = useAppConfig();
  const env = useEnvironment();
  const diagnostics = useDiagnostics();
  const updateConfig = useUpdateConfig();
  const toast = useToast();
  const [handPath, setHandPath] = useState<string | null>(null);
  const [fleetPath, setFleetPath] = useState<string | null>(null);
  const [customPath, setCustomPath] = useState("");

  const cfg = config.data;
  const effectiveHandPath = handPath ?? cfg?.handBinaryPath ?? "";
  const effectiveFleetPath = fleetPath ?? cfg?.fleetPath ?? "";
  const handCompatibility = env.data ? compatibilityFromEnvironment(env.data) : undefined;

  const save = async (input: Partial<AppConfig>, label: string) => {
    try {
      await updateConfig.mutateAsync(input);
      toast.showToast({ variant: "success", title: `${label} saved` });
    } catch {
      toast.showToast({ variant: "error", title: `Could not save ${label.toLowerCase()}` });
    }
  };

  const copyDiagnostics = () => {
    const text = JSON.stringify(
      {
        app: "Serenade",
        appVersion: diagnostics.data?.appVersion,
        mode: diagnostics.data?.mode,
        handPath: diagnostics.data?.handPath,
        handVersion: diagnostics.data?.handVersion,
        handCompatibility,
        supervisorHarness: cfg?.supervisorHarness ?? "opencode",
        fleetPath: diagnostics.data?.fleetPath,
        fleetValid: diagnostics.data?.fleetValid,
        capabilities: diagnostics.data?.capabilities,
        recentErrors: diagnostics.data?.recentErrors,
      },
      null,
      2,
    );
    void navigator.clipboard?.writeText(text);
    toast.showToast({ variant: "success", title: "Diagnostics copied" });
  };

  const statusRow = (ok: boolean | undefined, label: string) => (
    <div className="flex items-center gap-2 text-xs">
      {ok === undefined ? (
        <span className="h-3.5 w-3.5 rounded-full border border-line-strong" />
      ) : ok ? (
        <CircleCheck size={14} className="text-success" />
      ) : (
        <CircleX size={14} className="text-danger" />
      )}
      <span className={ok ? "text-fg-muted" : "text-danger"}>{label}</span>
    </div>
  );

  return (
    <PageContainer title="Settings" subtitle="Serenade preferences — hand configuration stays authoritative">
      <div className="grid gap-4 lg:grid-cols-2">
        <EnvironmentSection
          onRevalidate={() => {
            void queryClient.invalidateQueries({ queryKey: ["environment"] });
            void queryClient.invalidateQueries({ queryKey: ["config"] });
          }}
        />
        <Card>
          <CardHeader title="Fleet paths" />
          <div className="space-y-4 p-4">
            <Field label="hand binary path" hint="Executable name on PATH, or an absolute path.">
              <Input
                value={effectiveHandPath}
                onChange={(e) => setHandPath(e.target.value)}
                placeholder="hand"
              />
            </Field>
            <Field label="Fleet path">
              <Input
                value={effectiveFleetPath}
                onChange={(e) => setFleetPath(e.target.value)}
                placeholder="~/.hand/fleets/main"
              />
            </Field>
            <div className="space-y-1.5 rounded-lg bg-surface p-3">
              {(() => {
                const hand = env.data?.tools.find((t) => t.id === "hand");
                const handReady = hand?.state === "ready";
                return statusRow(handReady, handReady ? `hand found (${hand?.version ?? ""})` : hand?.message ?? "hand not found");
              })()}
              {(() => {
                const fleetReady = env.data?.fleet.state === "ready";
                return statusRow(fleetReady, fleetReady ? "fleet valid" : env.data?.fleet.message ?? "fleet missing or invalid");
              })()}
              {handCompatibility && (
                <p
                  className={`pl-5 text-[11px] ${
                    handCompatibility.mode === "supported"
                      ? "text-success"
                      : handCompatibility.mode === "warning"
                        ? "text-warning"
                        : "text-danger"
                  }`}
                >
                  Hand contract: {handCompatibility.contract} · {handCompatibility.reason}
                </p>
              )}
              {env.data?.issues.map((issue) => (
                <p key={issue} className="pl-5 text-[11px] text-warning">
                  {issue}
                </p>
              ))}
            </div>
            <Button
              variant="primary"
              onClick={() =>
                save(
                  { handBinaryPath: effectiveHandPath.trim() || null, fleetPath: effectiveFleetPath.trim() || null },
                  "Fleet settings",
                )
              }
              loading={updateConfig.isPending}
            >
              Save & validate
            </Button>
            <p className="text-[10px] leading-relaxed text-fg-subtle">
              Unknown/new Hand contracts remain available for diagnostics, but workflow mutations are blocked until the adapter is verified.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Supervisor" />
          <div className="space-y-4 p-4">
            <Field
              label="Supervisor Harness"
              hint="Separate from Hand worker routes/profiles. Serenade exposes only runtime adapters it has qualified."
            >
              <Select
                value={cfg?.supervisorHarness ?? "opencode"}
                onChange={(e) =>
                  save(
                    { supervisorHarness: e.target.value as NonNullable<AppConfig["supervisorHarness"]> },
                    "Supervisor Harness",
                  )
                }
              >
                <option value="opencode">OpenCode — qualified</option>
              </Select>
            </Field>
            <div className="rounded-lg border border-line bg-surface p-3">
              <p className="text-xs font-medium text-fg">Qualified runtime adapter</p>
              <p className="mt-1 text-[11px] leading-relaxed text-fg-subtle">
                OpenCode is currently the only Serenade Supervisor Harness with a verified headless/session invocation path. Claude, Codex, Pi, and other Hand-capable Harnesses will appear here only after their Supervisor runtime contracts are qualified; worker routing is unaffected.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Editor" />
          <div className="space-y-4 p-4">
            <Field label="Preferred editor">
              <Select
                value={cfg?.preferredEditor ?? "vscode"}
                onChange={(e) => save({ preferredEditor: e.target.value as AppConfig["preferredEditor"] }, "Editor")}
              >
                <option value="vscode">VS Code</option>
                <option value="cursor">Cursor</option>
                <option value="zed">Zed</option>
                <option value="custom">Custom executable</option>
              </Select>
            </Field>
            {cfg?.preferredEditor === "custom" && (
              <Field label="Custom editor path">
                <Input
                  value={cfg.customEditorPath ?? ""}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="C:\\tools\\my-editor\\editor.exe"
                />
              </Field>
            )}
            {cfg?.preferredEditor === "custom" && (
              <Button variant="secondary" size="sm" onClick={() => save({ customEditorPath: customPath }, "Editor path")}>
                Save editor path
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Interface" />
          <div className="space-y-4 p-4">
            <Field label="Appearance" hint="Dark is the designed default; light theme is planned.">
              <Select
                value={cfg?.appearance ?? "dark"}
                onChange={(e) => save({ appearance: e.target.value as AppConfig["appearance"] }, "Appearance")}
              >
                <option value="dark">dark</option>
                <option value="system">system</option>
              </Select>
            </Field>
            <Field label="Refresh profile">
              <Select
                value={cfg?.refreshProfile ?? "default"}
                onChange={(e) => save({ refreshProfile: e.target.value as AppConfig["refreshProfile"] }, "Refresh profile")}
              >
                <option value="slow">slow — fewer polls</option>
                <option value="default">default</option>
                <option value="fast">fast — more polls</option>
              </Select>
            </Field>
            <Switch
              label="Reduced motion"
              checked={cfg?.reducedMotion ?? false}
              onChange={(v) => save({ reducedMotion: v }, "Reduced motion")}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Notifications" />
          <div className="space-y-3 p-4">
            {(
              [
                ["workerFailed", "Worker failed"],
                ["taskCompleted", "Task completed"],
                ["reportReady", "Report ready"],
                ["approvalRequired", "Approval required"],
              ] as const
            ).map(([key, label]) => (
              <Switch
                key={key}
                label={label}
                checked={cfg?.notifications[key] ?? false}
                onChange={(v) => save({ notifications: { ...cfg!.notifications, [key]: v } }, label)}
              />
            ))}
            <p className="text-[10px] text-fg-subtle">
              Desktop notifications arrive post-MVP; these preferences are stored now.
            </p>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Diagnostics"
            action={
              <Button variant="secondary" size="xs" onClick={copyDiagnostics}>
                <Copy size={11} />
                Copy diagnostics
              </Button>
            }
          />
          <div className="grid gap-x-8 gap-y-2 p-4 text-xs sm:grid-cols-2">
            <Row label="App version" value={diagnostics.data?.appVersion ?? "…"} />
            <Row label="Mode" value={diagnostics.data?.mode ?? "…"} />
            <Row label="hand path" value={diagnostics.data?.handPath ?? "—"} mono />
            <Row label="hand version" value={diagnostics.data?.handVersion ?? "—"} />
            <Row label="Hand contract" value={handCompatibility?.contract ?? "—"} />
            <Row
              label="Workflow mutations"
              value={handCompatibility ? (handCompatibility.mutationsAllowed ? "enabled" : "blocked") : "—"}
            />
            <Row label="Supervisor Harness" value={cfg?.supervisorHarness ?? "opencode"} />
            <Row label="Fleet path" value={diagnostics.data?.fleetPath ?? "—"} mono />
            <Row label="Fleet valid" value={diagnostics.data?.fleetValid == null ? "—" : String(diagnostics.data.fleetValid)} />
            {Object.entries(diagnostics.data?.capabilities ?? {}).map(([cap, supported]) => (
              <Row key={cap} label={cap} value={supported ? "supported" : "not available"} />
            ))}
          </div>
          {diagnostics.data?.recentErrors && diagnostics.data.recentErrors.length > 0 && (
            <div className="border-t border-line p-4">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Recent backend errors</p>
              {diagnostics.data.recentErrors.map((err, i) => (
                <p key={i} className="font-mono text-[11px] text-danger/80">{err}</p>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-fg-subtle">{label}</span>
      <span className={`min-w-0 truncate text-right text-fg-muted ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
    </div>
  );
}
