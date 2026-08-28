import type { ReactNode } from "react";
import { HashRouter } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Providers } from "./providers";
import { Router } from "./router";
import { SetupScreen } from "@/features/setup/SetupScreen";
import { useEnvironment } from "@/hooks/use-config";

/**
 * First-run flow (architecture.md §20): detect hand → detect fleet → app.
 * When the environment is not usable, the setup screen replaces the shell.
 */
function EnvironmentGate({ children }: { children: ReactNode }) {
  const env = useEnvironment();
  const queryClient = useQueryClient();

  if (env.isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-base text-xs text-fg-subtle">
        Checking environment…
      </div>
    );
  }
  if (env.data && !env.data.ok) {
    const onRevalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["environment"] });
      void queryClient.invalidateQueries({ queryKey: ["config"] });
    };
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
