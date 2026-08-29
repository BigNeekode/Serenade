import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MockSerenadeApi } from "@/lib/api/mock";
import { ApiContext } from "@/lib/api";
import { ToastProvider } from "@/components/ui/toast";
import { ProjectCreateDialog } from "@/features/projects/ProjectCreateDialog";

function renderDialog(api: MockSerenadeApi) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={api}>
        <ToastProvider>
          <ProjectCreateDialog open onClose={() => {}} />
        </ToastProvider>
      </ApiContext.Provider>
    </QueryClientProvider>,
  );
}

describe("ProjectCreateDialog", () => {
  it("creates a new local-only project", async () => {
    const api = new MockSerenadeApi();
    const user = userEvent.setup();
    renderDialog(api);

    await user.click(screen.getByText("Create a new project"));
    await user.type(screen.getByLabelText("Project name"), "demo-project");
    await user.click(screen.getByRole("button", { name: /create project/i }));

    expect(await screen.findByText("Project created")).toBeInTheDocument();
    const projects = await api.listProjects();
    expect(projects.some((p) => p.name === "demo-project")).toBe(true);
  });

  it("adds a project from a Git URL", async () => {
    const api = new MockSerenadeApi();
    const user = userEvent.setup();
    renderDialog(api);

    await user.type(screen.getByLabelText("Repository URL"), "https://github.com/acme/demo.git");
    await user.click(screen.getByRole("button", { name: /add project/i }));

    expect(await screen.findByText("Project added")).toBeInTheDocument();
    const projects = await api.listProjects();
    expect(projects.some((p) => p.name === "demo")).toBe(true);
  });

  it("shows an error when the required field is empty", async () => {
    const api = new MockSerenadeApi();
    const user = userEvent.setup();
    renderDialog(api);

    await user.click(screen.getByRole("button", { name: /add project/i }));
    expect(await screen.findByText(/enter a git repository url/i)).toBeInTheDocument();
  });
});
