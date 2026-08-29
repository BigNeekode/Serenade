import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MockSerenadeApi } from "@/lib/api/mock";
import { ApiContext } from "@/lib/api";
import { UiStoreProvider } from "@/state/ui-store";
import { ToastProvider } from "@/components/ui/toast";
import { SetupScreen } from "@/features/setup/SetupScreen";
import type { EnvironmentStatus } from "@/types/domain";

function renderSetup(env: EnvironmentStatus) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={new MockSerenadeApi()}>
        <UiStoreProvider>
          <ToastProvider>
            <SetupScreen env={env} onRevalidate={() => {}} />
          </ToastProvider>
        </UiStoreProvider>
      </ApiContext.Provider>
    </QueryClientProvider>,
  );
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
});
