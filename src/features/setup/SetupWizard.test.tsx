import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MockSerenadeApi } from "@/lib/api/mock";
import { ApiContext } from "@/lib/api";
import { UiStoreProvider } from "@/state/ui-store";
import { ToastProvider } from "@/components/ui/toast";
import { SetupWizard } from "@/features/setup/SetupWizard";
import type { EnvironmentStatus } from "@/types/domain";

function renderWizard(env: EnvironmentStatus) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={new MockSerenadeApi()}>
        <UiStoreProvider>
          <ToastProvider>
            <SetupWizard env={env} onComplete={() => {}} onRevalidate={() => {}} />
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

describe("SetupWizard", () => {
  it("starts at the welcome screen", () => {
    renderWizard(baseEnv());
    expect(screen.getByText(/welcome to serenade/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get started/i })).toBeInTheDocument();
  });

  it("advances through welcome → scan → mode → fleet", () => {
    renderWizard(baseEnv());
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    expect(screen.getByText(/environment check/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByText(/choose setup mode/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/quick setup/i));
    expect(screen.getByText(/where should your fleet live/i)).toBeInTheDocument();
  });

  it("registers a project from the wizard", async () => {
    const api = new MockSerenadeApi();
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ApiContext.Provider value={api}>
          <UiStoreProvider>
            <ToastProvider>
              <SetupWizard env={baseEnv()} onComplete={() => {}} onRevalidate={() => {}} />
            </ToastProvider>
          </UiStoreProvider>
        </ApiContext.Provider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByText(/quick setup/i));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /prepare environment/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /prepare environment/i }));
    await waitFor(() => expect(screen.getByText(/set up serenade supervisor/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));
    expect(screen.getByText(/add your first project/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/create a new local-only project/i));
    fireEvent.change(screen.getByPlaceholderText("new-project"), { target: { value: "demo-project" } });
    fireEvent.click(screen.getByRole("button", { name: /add project/i }));

    await waitFor(() => expect(screen.getByText(/everything is ready/i)).toBeInTheDocument());
    const projects = await api.listProjects();
    expect(projects.some((p) => p.name === "demo-project")).toBe(true);
  });

  it("allows skipping Supervisor", async () => {
    renderWizard(baseEnv());
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByText(/quick setup/i));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /prepare environment/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /prepare environment/i }));
    await waitFor(() => expect(screen.getByText(/set up serenade supervisor/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));
    expect(screen.getByText(/add your first project/i)).toBeInTheDocument();
  });
});
