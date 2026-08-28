import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./query-client";
import { ApiProvider } from "@/lib/api";
import { UiStoreProvider } from "@/state/ui-store";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider>
        <UiStoreProvider>
          <ToastProvider>{children}</ToastProvider>
        </UiStoreProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
