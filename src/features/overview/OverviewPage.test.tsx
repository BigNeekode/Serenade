import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MockSerenadeApi } from "@/lib/api/mock";
import { ApiContext } from "@/lib/api";
import { UiStoreProvider } from "@/state/ui-store";
import { ToastProvider } from "@/components/ui/toast";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { MemoryRouter } from "react-router-dom";

function renderOverview(api: MockSerenadeApi) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={api}>
        <UiStoreProvider>
          <ToastProvider>
            <MemoryRouter>
              <OverviewPage />
            </MemoryRouter>
          </ToastProvider>
        </UiStoreProvider>
      </ApiContext.Provider>
    </QueryClientProvider>,
  );
}

describe("Fleet Overview", () => {
  it("shows summary metrics computed from fleet data", async () => {
    renderOverview(new MockSerenadeApi());

    // wait for data-driven content before asserting counts
    expect(await screen.findByText(/rate limiting/i)).toBeInTheDocument();
    expect(screen.getByText("Active Projects")).toBeInTheDocument();
    expect(screen.getByText("Active Agents")).toBeInTheDocument();
    expect(screen.getByText("Failed Tasks")).toBeInTheDocument();
    expect(screen.getByText("Success Rate")).toBeInTheDocument();

    // mock fleet: 2 failed tasks (t_1047, t_1060) — wait for the stat to fill in
    await waitFor(() => {
      const failedStat = document.querySelector('[data-stat="failed-tasks"]');
      expect(failedStat).toHaveTextContent("2");
    });
  });

  it("flags stale worker heartbeats as a legacy-derived diagnostic", async () => {
    renderOverview(new MockSerenadeApi());
    // ag_opus_1 has a stale heartbeat in the mock data; the Attention surface
    // now renders it as a legacy-derived diagnostic, not canonical Hand Attention.
    const diagnostics = await screen.findAllByText(/not canonical Hand Attention/i);
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("ag_opus_1")).toBeInTheDocument();
  });
});

describe("MockSerenadeApi", () => {
  it("creates tasks and appends them to the project backlog", async () => {
    const api = new MockSerenadeApi();
    const before = (await api.listTasks("p_atlas")).length;
    const task = await api.createTask({
      projectId: "p_atlas",
      title: "A brand new task",
      type: "ship",
      executionClass: "mechanical",
      tags: ["test"],
    });
    expect(task.status).toBe("backlog");
    expect(task.title).toBe("A brand new task");
    const after = (await api.listTasks("p_atlas")).length;
    expect(after).toBe(before + 1);

    // a task.created event should be recorded
    const events = await api.listEvents(5);
    expect(events[0].kind).toBe("task.created");
    expect(events[0].message).toContain("A brand new task");
  });

  it("throws a structured TASK_NOT_FOUND error for unknown ids", async () => {
    const api = new MockSerenadeApi();
    await expect(api.getTask("t_missing")).rejects.toMatchObject({ code: "TASK_NOT_FOUND" });
  });

  it("sends instructions which are appended to task logs", async () => {
    const api = new MockSerenadeApi();
    await api.sendTaskMessage("t_1042", "please prefer an env-based config");
    const chunk = await api.readTaskLogs({ taskId: "t_1042" });
    const messages = chunk.lines.map((l) => l.message);
    expect(messages).toContain("please prefer an env-based config");
    expect(messages).toContain("instruction delivered to worker");
  });

  it("retries failed tasks and resets their worker", async () => {
    const api = new MockSerenadeApi();
    await api.retryTask("t_1047");
    const task = await api.getTask("t_1047");
    expect(task.status).toBe("in_progress");
    expect(task.attempts).toBe(3);
    const agents = await api.listAgents();
    expect(agents.find((a) => a.id === "ag_codex_3")?.status).toBe("running");
  });

  it("validates the environment from config", async () => {
    const api = new MockSerenadeApi();
    let env = await api.validateEnvironment();
    expect(env.ok).toBe(true);
    await api.updateConfig({ handBinaryPath: null, fleetPath: null });
    env = await api.validateEnvironment();
    expect(env.ok).toBe(false);
    expect(env.issues.length).toBeGreaterThan(0);
  });
});
