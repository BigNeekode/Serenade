import { useState } from "react";
import { CircleCheck, CircleX, Loader2, ArrowRight, RotateCcw, SkipForward } from "lucide-react";
import type { EnvironmentStatus, ToolStatus } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useUpdateConfig } from "@/hooks/use-config";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

export type WizardStep =
  | "welcome"
  | "scan"
  | "mode"
  | "fleet"
  | "plan"
  | "supervisor"
  | "project"
  | "ready";

export type SetupMode = "quick" | "existing";

interface WizardState {
  step: WizardStep;
  mode?: SetupMode;
  fleetPath: string;
  handPath: string;
  supervisorSkipped: boolean;
  projectUrl: string;
  projectLocalPath: string;
  projectName: string;
  projectInputMode: "url" | "local" | "create";
}

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

function WizardLayout({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full items-center justify-center bg-base px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-fg">{title}</h1>
          {subtitle && <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{subtitle}</p>}
        </div>
        <div className="rounded-xl border border-line bg-panel p-5">
          {children}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">{actions}</div>
        </div>
      </div>
    </div>
  );
}

export function SetupWizard({
  env,
  onComplete,
  onRevalidate,
}: {
  env: EnvironmentStatus;
  onComplete: () => void;
  onRevalidate: () => void;
}) {
  const updateConfig = useUpdateConfig();
  const api = useApi();
  const toast = useToast();
  const handTool = env.tools.find((t) => t.id === "hand");
  const supervisorTool = env.tools.find((t) => t.id === "supervisor");

  const [state, setState] = useState<WizardState>({
    step: "welcome",
    fleetPath: env.fleet.path ?? defaultFleetPath(),
    handPath: handTool?.path ?? "hand",
    supervisorSkipped: false,
    projectUrl: "",
    projectLocalPath: "",
    projectName: "",
    projectInputMode: "url",
  });

  const [busy, setBusy] = useState(false);

  function defaultFleetPath() {
    // Windows-first default per design.md §3.
    if (typeof window !== "undefined" && window.navigator.userAgent.includes("Windows")) {
      return "C:\\Users\\%USERNAME%\\Serenade\\fleet".replace("%USERNAME%", "you");
    }
    return "~/Serenade/fleet";
  }

  const setStep = (step: WizardStep) => setState((s) => ({ ...s, step }));

  const saveConfig = async (patch: Record<string, unknown>) => {
    await updateConfig.mutateAsync(patch);
  };

  const handleModeSelect = async (mode: SetupMode) => {
    setState((s) => ({ ...s, mode, step: mode === "existing" ? "fleet" : "fleet" }));
  };

  const handleFleetContinue = async () => {
    const path = state.fleetPath.trim();
    if (!path) {
      toast.showToast({ variant: "error", title: "Enter a fleet path" });
      return;
    }
    try {
      await saveConfig({ fleetPath: path });
      onRevalidate();
      setStep("plan");
    } catch {
      toast.showToast({ variant: "error", title: "Could not save fleet path" });
    }
  };

  const handlePlanExecute = async () => {
    setBusy(true);
    try {
      // Install a managed Hand when no qualified Hand is present.
      if (handTool?.state !== "ready") {
        try {
          const result = await api.installManagedHand();
          toast.showToast({ variant: "success", title: "Hand installed", description: result });
        } catch (err) {
          toast.showToast({
            variant: "error",
            title: "Managed Hand installation failed",
            description: err instanceof Error ? err.message : undefined,
          });
          return;
        }
      }

      // Initialize the Fleet if it is not already valid.
      if (env.fleet.state !== "ready") {
        try {
          await api.initializeFleet(state.fleetPath.trim());
          toast.showToast({ variant: "success", title: "Fleet initialized" });
        } catch (err) {
          toast.showToast({
            variant: "error",
            title: "Fleet initialization failed",
            description: err instanceof Error ? err.message : undefined,
          });
          return;
        }
      }

      await saveConfig({ handBinaryPath: state.handPath.trim() || null, fleetPath: state.fleetPath.trim() || null });
      onRevalidate();
      setStep("supervisor");
    } finally {
      setBusy(false);
    }
  };

  const handleSupervisorSkip = () => {
    setState((s) => ({ ...s, supervisorSkipped: true, step: "project" }));
  };

  const handleSupervisorSetup = async () => {
    setState((s) => ({ ...s, supervisorSkipped: false, step: "project" }));
  };

  const handleProjectContinue = async () => {
    try {
      if (state.projectInputMode === "url" && state.projectUrl.trim()) {
        await api.addProject(state.projectUrl.trim());
        toast.showToast({ variant: "success", title: "Project added", description: state.projectUrl.trim() });
      } else if (state.projectInputMode === "local" && state.projectLocalPath.trim()) {
        await api.addProject(state.projectLocalPath.trim());
        toast.showToast({ variant: "success", title: "Project added", description: state.projectLocalPath.trim() });
      } else if (state.projectInputMode === "create" && state.projectName.trim()) {
        await api.createProject(state.projectName.trim());
        toast.showToast({ variant: "success", title: "Project created", description: state.projectName.trim() });
      }
      onRevalidate();
      setStep("ready");
    } catch (err) {
      toast.showToast({
        variant: "error",
        title: "Could not register project",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleFinish = async () => {
    try {
      await saveConfig({ setupCompleted: true });
      onComplete();
    } catch {
      toast.showToast({ variant: "error", title: "Could not finish setup" });
    }
  };

  const retryScan = () => {
    onRevalidate();
  };

  if (state.step === "welcome") {
    return (
      <WizardLayout
        title="Welcome to Serenade"
        subtitle="Serenade can prepare the local tools needed to run your AI coding fleet."
        actions={
          <Button variant="primary" onClick={() => setStep("scan")}>
            Get Started <ArrowRight size={13} />
          </Button>
        }
      >
        <p className="text-xs text-fg-muted">
          You can let Serenade manage compatible tools, or use an existing Secondhand environment.
        </p>
      </WizardLayout>
    );
  }

  if (state.step === "scan") {
    return (
      <WizardLayout
        title="Environment Check"
        subtitle="Serenade scanned your system for the tools it needs."
        actions={
          <>
            <Button variant="secondary" onClick={retryScan} disabled={busy}>
              <RotateCcw size={13} /> Rescan
            </Button>
            <Button variant="primary" onClick={() => setStep("mode")}>
              Continue <ArrowRight size={13} />
            </Button>
          </>
        }
      >
        <div className="space-y-1.5 rounded-lg bg-surface p-3">
          {env.tools.map((tool) => (
            <div key={tool.id} className="flex items-center gap-2 text-xs">
              {toolStateIcon(tool.state)}
              <span className={tool.state === "ready" || tool.state === "installed" ? "text-fg-muted" : "text-danger"}>
                {tool.label} {tool.version ? `(${tool.version})` : ""} {tool.ownership ? `· ${tool.ownership}` : ""}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs">
            {env.fleet.state === "ready" ? (
              <CircleCheck size={14} className="text-success" />
            ) : (
              <CircleX size={14} className="text-danger" />
            )}
            <span className={env.fleet.state === "ready" ? "text-fg-muted" : "text-danger"}>
              {env.fleet.state === "ready" ? `Fleet ready (${env.fleet.path})` : env.fleet.message ?? "Fleet not configured"}
            </span>
          </div>
          {env.issues.map((issue) => (
            <p key={issue} className="pl-5 text-[11px] text-warning">
              {issue}
            </p>
          ))}
        </div>
      </WizardLayout>
    );
  }

  if (state.step === "mode") {
    return (
      <WizardLayout
        title="Choose setup mode"
        subtitle="You can change individual tools after choosing."
        actions={
          <Button variant="secondary" onClick={() => setStep("scan")}>
            Back
          </Button>
        }
      >
        <div className="space-y-3">
          <button
            onClick={() => handleModeSelect("quick")}
            className="w-full rounded-lg border border-line bg-surface p-4 text-left hover:border-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border border-line-strong" />
              <span className="text-sm font-medium text-fg">Quick setup</span>
            </div>
            <p className="mt-1 pl-6 text-[11px] text-fg-muted">Serenade manages compatible tools for you.</p>
          </button>
          <button
            onClick={() => handleModeSelect("existing")}
            className="w-full rounded-lg border border-line bg-surface p-4 text-left hover:border-accent/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border border-line-strong" />
              <span className="text-sm font-medium text-fg">Use existing environment</span>
            </div>
            <p className="mt-1 pl-6 text-[11px] text-fg-muted">Choose already-installed executables and Fleet state.</p>
          </button>
        </div>
      </WizardLayout>
    );
  }

  if (state.step === "fleet") {
    return (
      <WizardLayout
        title="Where should your Fleet live?"
        subtitle="This location will contain Fleet state, project clones, worktrees, and reports."
        actions={
          <>
            <Button variant="secondary" onClick={() => setStep("mode")}>
              Back
            </Button>
            <Button variant="primary" onClick={handleFleetContinue} disabled={updateConfig.isPending}>
              Continue <ArrowRight size={13} />
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Fleet path">
            <Input
              value={state.fleetPath}
              onChange={(e) => setState((s) => ({ ...s, fleetPath: e.target.value }))}
              placeholder="C:\\Users\\you\\Serenade\\fleet"
            />
          </Field>
          <ul className="list-disc space-y-1 pl-4 text-[11px] text-fg-subtle">
            <li>Fleet state</li>
            <li>Project clones</li>
            <li>Task worktrees</li>
            <li>Reports</li>
          </ul>
        </div>
      </WizardLayout>
    );
  }

  if (state.step === "plan") {
    return (
      <WizardLayout
        title="Setup plan"
        subtitle="Quick Setup will prepare the following before making any changes."
        actions={
          <>
            <Button variant="secondary" onClick={() => setStep("fleet")}>
              Back
            </Button>
            <Button variant="primary" onClick={handlePlanExecute} disabled={busy}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
              Prepare Environment
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-xs">
          <PlanRow label="Git" value={env.tools.find((t) => t.id === "git")?.state === "ready" ? "Use existing" : "Detect only — install manually if missing"} />
          <PlanRow label="Secondhand / hand" value={handTool?.state === "ready" ? `Use ${handTool.ownership ?? "existing"}` : "Install or configure a qualified version"} />
          <PlanRow label="Fleet" value={`Initialize at ${state.fleetPath || "—"}`} />
          <PlanRow label="Supervisor" value={state.supervisorSkipped ? "Skip for now" : "Detect OpenCode (optional)"} />
        </div>
      </WizardLayout>
    );
  }

  if (state.step === "supervisor") {
    return (
      <WizardLayout
        title="Set up Serenade Supervisor?"
        subtitle="OpenCode is currently the qualified Supervisor runtime. Supervisor setup is optional."
        actions={
          <>
            <Button variant="secondary" onClick={handleSupervisorSkip}>
              <SkipForward size={13} /> Skip
            </Button>
            <Button variant="primary" onClick={handleSupervisorSetup}>
              Set up OpenCode
            </Button>
          </>
        }
      >
        <div className="space-y-1.5 rounded-lg bg-surface p-3 text-xs">
          <div className="flex items-center gap-2">
            {supervisorTool?.state === "installed" || supervisorTool?.state === "ready" ? (
              <CircleCheck size={14} className="text-success" />
            ) : (
              <CircleX size={14} className="text-danger" />
            )}
            <span>
              {supervisorTool?.message ?? "OpenCode status unknown"}
            </span>
          </div>
        </div>
      </WizardLayout>
    );
  }

  if (state.step === "project") {
    return (
      <WizardLayout
        title="Add your first project"
        subtitle="Only modes supported by your qualified Hand version are shown."
        actions={
          <>
            <Button variant="secondary" onClick={() => setStep("supervisor")}>
              Back
            </Button>
            <Button variant="primary" onClick={handleProjectContinue}>
              {state.projectUrl.trim() || state.projectLocalPath.trim() || state.projectName.trim()
                ? "Add project"
                : "Skip"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                checked={state.projectInputMode === "url"}
                onChange={() => setState((s) => ({ ...s, projectInputMode: "url" }))}
              />
              Git repository URL
            </label>
            <Input
              value={state.projectUrl}
              onChange={(e) => setState((s) => ({ ...s, projectUrl: e.target.value }))}
              placeholder="https://github.com/example/repo"
              disabled={state.projectInputMode !== "url"}
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                checked={state.projectInputMode === "local"}
                onChange={() => setState((s) => ({ ...s, projectInputMode: "local" }))}
              />
              Existing local repository
            </label>
            <Input
              value={state.projectLocalPath}
              onChange={(e) => setState((s) => ({ ...s, projectLocalPath: e.target.value }))}
              placeholder="C:\\Projects\\my-project"
              disabled={state.projectInputMode !== "local"}
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                checked={state.projectInputMode === "create"}
                onChange={() => setState((s) => ({ ...s, projectInputMode: "create" }))}
              />
              Create a new local-only project
            </label>
            <Input
              value={state.projectName}
              onChange={(e) => setState((s) => ({ ...s, projectName: e.target.value }))}
              placeholder="new-project"
              disabled={state.projectInputMode !== "create"}
            />
          </div>
        </div>
      </WizardLayout>
    );
  }

  // ready
  return (
    <WizardLayout
      title="Everything is ready"
      subtitle="Serenade has the required capabilities to open."
      actions={
        <Button variant="primary" onClick={handleFinish}>
          Open Serenade
        </Button>
      }
    >
      <div className="space-y-1.5 rounded-lg bg-surface p-3 text-xs">
        <SummaryRow label="Fleet" value={state.fleetPath} />
        <SummaryRow label="Hand" value={handTool?.version ?? "—"} />
        <SummaryRow label="Supervisor" value={state.supervisorSkipped ? "Skipped" : supervisorTool?.path ?? "OpenCode"} />
      </div>
    </WizardLayout>
  );
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-fg-subtle">{label}</span>
      <span className="text-right text-fg">{value}</span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-fg-subtle">{label}</span>
      <span className="text-right text-fg-muted">{value}</span>
    </div>
  );
}
