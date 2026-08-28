import { createContext, useContext, type ReactNode } from "react";
import { MockSerenadeApi, mockApi } from "./mock";
import { TauriSerenadeApi } from "./tauri";
import type { SerenadeApi } from "./interface";

export type { SerenadeApi } from "./interface";
export { MockSerenadeApi, TauriSerenadeApi, mockApi };

/**
 * Detects whether the UI runs inside a Tauri webview. When it does, the real
 * backend adapter is used; otherwise the mock keeps the UI fully functional
 * (architecture.md §3: "Support a mock backend for UI development").
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function createApi(): SerenadeApi {
  return isTauri() ? new TauriSerenadeApi() : new MockSerenadeApi();
}

export const ApiContext = createContext<SerenadeApi>(mockApi);

export function ApiProvider({ api, children }: { api?: SerenadeApi; children: ReactNode }) {
  return <ApiContext.Provider value={api ?? createApi()}>{children}</ApiContext.Provider>;
}

export function useApi(): SerenadeApi {
  return useContext(ApiContext);
}
