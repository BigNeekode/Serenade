import { QueryClient } from "@tanstack/react-query";
import { SerenadeApiError } from "@/types/domain";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2_000,
      retry: (failureCount, error) => {
        if (error instanceof SerenadeApiError && !error.recoverable) return false;
        return failureCount < 2;
      },
      // Views poll at their own cadence; focus-triggered refetches would
      // burst hand processes every alt-tab.
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
