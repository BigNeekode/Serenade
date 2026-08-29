import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MockSerenadeApi } from "@/lib/api/mock";
import { ApiContext } from "@/lib/api";
import { UiStoreProvider } from "@/state/ui-store";
import { ToastProvider } from "@/components/ui/toast";
import { SetupScreen } from "@/features/setup/SetupScreen";
import type { EnvironmentStatus, ToolStatus } from "@/types/domain";

function renderSetupWithApi(env: EnvironmentStatus, api: MockSerenadeApi) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={api}>
        <UiStoreProvider>
          <ToastProvider>
            <SetupScreen env={env} onRevalidate={() => {}} />
          </ToastProvider>
        </UiStoreProvider>
      </ApiContext.Provider>
    </QueryClientProvider>,
  );
}

function renderSetup(env: EnvironmentStatus) {
  renderSetupWithApi(env, new MockSerenadeApi());
}

function runtimeTool(id: string, label: string): ToolStatus {
  return {
    id,
    label,
    required: true,
    state: "missing",
    compatible: false,
    message: `${label} was not found.`,
    capabilities: [],
  };
}

function baseEnv(overrides: Partial<EnvironmentStatus> = {}): EnvironmentStatus {
  return {
    platform: { os: "mock", arch: "mock" },
    tools: [
      {
        id: "git",
        label: "Git",
        required: true,
        ownership: "system",
        path: "/usr/bin/git",
        version: "2.42.0",
        state: "ready",
        compatible: true,
        message: "System Git detected.",
        capabilities: ["version-control"],
      },
      {
        id: "hand",
        label: "Secondhand / hand",
        required: true,
        state: "missing",
        compatible: false,
        message: "No Hand executable found.",
        suggestedAction: "Use Quick Setup to install a managed version, or set a system/custom Hand path.",
        capabilities: ["fleet"],
      },
      {
        id: "supervisor",
        label: "Serenade Supervisor (OpenCode)",
        required: false,
        ownership: "system",
        path: "/usr/bin/opencode",
        version: "0.1.0",
        state: "installed",
        compatible: true,
        message: "OpenCode executable found.",
        capabilities: ["supervisor-chat"],
      },
    ],
    fleet: { state: "missing", message: "No Fleet path configured." },
    ready: false,
    issues: ["hand executable not found", "fleet missing or invalid"],
    ...overrides,
  };
}

describe("Setup screen (UX-ERROR-001)", () => {
  it("explains what is missing when hand and fleet are not found", () => {
    renderSetup(baseEnv());

    expect(screen.getByText(/welcome to serenade/i)).toBeInTheDocument();
    expect(screen.getByText(/Secondhand \/ hand/i)).toBeInTheDocument();
    expect(screen.getAllByText(/fleet missing or invalid/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/hand binary path/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fleet path/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save & validate/i })).toBeInTheDocument();
  });

  it("shows hand as found when detected", () => {
    renderSetup(
      baseEnv({
        tools: baseEnv().tools.map((t) =>
          t.id === "hand"
            ? {
                ...t,
                ownership: "system",
                path: "/usr/bin/hand",
                version: "0.6.3",
                state: "ready" as const,
                compatible: true,
                message: "Verified legacy Hand 0.6 integration.",
                suggestedAction: undefined,
              }
            : t,
        ),
        fleet: { path: "/fleets/main", state: "ready", message: "Valid Fleet home detected." },
        ready: true,
        issues: [],
      }),
    );
    expect(screen.getByText(/Secondhand \/ hand \(0\.6\.3\)/i)).toBeInTheDocument();
  });

  it("offers per-tool install actions and repairs all missing tools automatically", async () => {
    const api = new MockSerenadeApi();
    const handSpy = vi.spyOn(api, "installManagedHand");
    const treehouseSpy = vi.spyOn(api, "installTreehouse");
    const herdrSpy = vi.spyOn(api, "installHerdr");
    const user = userEvent.setup();

    renderSetupWithApi(
      baseEnv({
        tools: [
          ...baseEnv().tools.filter((t) => t.id !== "supervisor"),
          runtimeTool("treehouse", "Treehouse"),
          runtimeTool("herdr", "Herdr"),
        ],
      }),
      api,
    );

    // Per-tool install buttons are offered next to each missing tool.
    expect(screen.getAllByRole("button", { name: /install/i }).length).toBeGreaterThanOrEqual(3);

    await user.click(screen.getByRole("button", { name: /repair automatically/i }));

    await waitFor(() => expect(handSpy).toHaveBeenCalled(), { timeout: 5000 });
    await waitFor(() => expect(treehouseSpy).toHaveBeenCalled(), { timeout: 5000 });
    await waitFor(() => expect(herdrSpy).toHaveBeenCalled(), { timeout: 5000 });
  });
});
