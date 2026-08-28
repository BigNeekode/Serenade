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

describe("Setup screen (UX-ERROR-001)", () => {
  it("explains what is missing when hand and fleet are not found", () => {
    renderSetup({
      ok: false,
      handFound: false,
      fleetValid: false,
      issues: [
        "hand executable not found — configure the binary path in Settings.",
        "fleet path is not set or does not look like a valid hand fleet.",
      ],
    });

    expect(screen.getByText(/welcome to serenade/i)).toBeInTheDocument();
    expect(screen.getByText("hand executable not found")).toBeInTheDocument();
    expect(screen.getByText("fleet missing or invalid")).toBeInTheDocument();
    expect(screen.getByLabelText(/hand binary path/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fleet path/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save & validate/i })).toBeInTheDocument();
  });

  it("shows hand as found when detected", () => {
    renderSetup({
      ok: false,
      handFound: true,
      handVersion: "0.9.3",
      fleetValid: false,
      issues: ["fleet path is not set or does not look like a valid hand fleet."],
    });
    expect(screen.getByText(/hand found \(0\.9\.3\)/i)).toBeInTheDocument();
  });
});
