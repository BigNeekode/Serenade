import type { ReactNode } from "react";
import { HashRouter } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Providers } from "./providers";
import { Router } from "./router";
import { SetupScreen } from "@/features/setup/SetupScreen";
import { SetupWizard } from "@/features/setup/SetupWizard";
import { useAppConfig, useEnvironment } from "@/hooks/use-config";

/**
 * First-run flow (architecture.md §20): when setup has never been completed,
 * show the Quick Setup wizard. When setup was completed but the environment is
 * no longer ready, show the repair/setup screen. Otherwise show the app.
 */
function EnvironmentGate({ children }: { children: ReactNode }) {
  const env = useEnvironment();
  const config = useAppConfig();
  const queryClient = useQueryClient();

  const onRevalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["environment"] });
    void queryClient.invalidateQueries({ queryKey: ["config"] });
  };

  if (env.isLoading || config.isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-base text-xs text-fg-subtle">
        Checking environment…
      </div>
    );
  }

  const ready = env.data?.ready ?? false;
  const setupCompleted = config.data?.setupCompleted ?? false;

  if (!setupCompleted && env.data) {
    return <SetupWizard env={env.data} onComplete={onRevalidate} onRevalidate={onRevalidate} />;
  }

  if (!ready && env.data) {
    return <SetupScreen env={env.data} onRevalidate={onRevalidate} />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <Providers>
      <EnvironmentGate>
        <HashRouter>
          <Router />
        </HashRouter>
      </EnvironmentGate>
    </Providers>
  );
}
