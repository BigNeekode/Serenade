import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MockSerenadeApi } from "@/lib/api/mock";
import { ApiContext } from "@/lib/api";
import { UiStoreProvider } from "@/state/ui-store";
import { ToastProvider } from "@/components/ui/toast";
import { ProjectDashboardPage } from "@/features/projects/ProjectDashboardPage";

function renderDashboard(projectId = "p_atlas") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={new MockSerenadeApi()}>
        <UiStoreProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={[`/projects/${projectId}`]}>
              <Routes>
                <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </UiStoreProvider>
      </ApiContext.Provider>
    </QueryClientProvider>,
  );
}

describe("Project dashboard board", () => {
  it("renders the seven kanban columns with counts", async () => {
    renderDashboard();

    // wait for board data to load before asserting counts
    expect(await screen.findByText(/query latency regression/i)).toBeInTheDocument();

    for (const column of ["Backlog", "Scouting", "Ready to Ship", "In Progress", "Review", "Done", "Blocked"]) {
      expect(screen.getByText(column)).toBeInTheDocument();
    }

    // atlas-api mock: t_1041 scouting, t_1042+t_1044 in progress
    const scoutingHeader = screen.getByText("Scouting").closest("div");
    expect(scoutingHeader).toHaveTextContent("1");
  });

  it("filters tasks by type", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByText("Implement per-tenant rate limiting");
    const typeSelect = screen.getAllByDisplayValue("all types")[0];
    await user.selectOptions(typeSelect, "scout");

    expect(screen.queryByText("Implement per-tenant rate limiting")).not.toBeInTheDocument();
    expect(screen.getByText(/query latency regression/i)).toBeInTheDocument();
  });

  it("searches tasks by title", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByText("Implement per-tenant rate limiting");
    const search = screen.getByPlaceholderText("Search tasks…");
    await user.type(search, "rate limiting");

    expect(screen.getByText("Implement per-tenant rate limiting")).toBeInTheDocument();
    expect(screen.queryByText(/auth flow/i)).not.toBeInTheDocument();
  });

  it("shows summary cards with fleet counts", async () => {
    renderDashboard();
    expect(await screen.findByText("Total Tasks")).toBeInTheDocument();
    expect(screen.getByText("Ships")).toBeInTheDocument();
    expect(screen.getByText("Scouts")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Pending Review")).toBeInTheDocument();
  });
});
