import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MockSerenadeApi } from "@/lib/api/mock";
import { ApiContext } from "@/lib/api";
import { ToastProvider } from "@/components/ui/toast";
import { TaskCard } from "@/features/tasks/TaskCard";
import type { Task } from "@/types/domain";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t_9999",
    projectId: "p_atlas",
    title: "Add cursor pagination to /users",
    type: "ship",
    executionClass: "standard",
    status: "in_progress",
    tags: ["api", "perf"],
    attempts: 1,
    progress: 42,
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    updatedAt: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={new MockSerenadeApi()}>
        <ToastProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </ToastProvider>
      </ApiContext.Provider>
    </QueryClientProvider>,
  );
}

describe("TaskCard", () => {
  it("renders task id, title, type, class and tags", () => {
    renderWithProviders(<TaskCard task={makeTask()} />);
    const card = screen.getByTestId("task-card-t_9999");
    expect(within(card).getByText("t_9999")).toBeInTheDocument();
    expect(within(card).getByText("Add cursor pagination to /users")).toBeInTheDocument();
    expect(within(card).getByText("SHIP")).toBeInTheDocument();
    expect(within(card).getByText("standard")).toBeInTheDocument();
    expect(within(card).getByText("#api")).toBeInTheDocument();
  });

  it("shows failed tasks with attempt information", () => {
    renderWithProviders(<TaskCard task={makeTask({ status: "failed", attempts: 2 })} />);
    expect(screen.getByText(/attempt 2/i)).toBeInTheDocument();
  });

  it("invokes onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProviders(<TaskCard task={makeTask()} onClick={onClick} />);
    await user.click(screen.getByTestId("task-card-t_9999"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
