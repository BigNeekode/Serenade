import { invoke } from "@tauri-apps/api/core";
import type { EnvironmentStatus } from "@/types/domain";
import {
  assertHandMutationCompatible,
  compatibilityFromEnvironment,
  type HandCompatibility,
} from "./compatibility";

/**
 * Transitional Hand integration boundary.
 *
 * The rest of Serenade should not make compatibility decisions from raw
 * version strings. This gateway centralizes contract negotiation now and is
 * the seam where the legacy 0.6/0.7 adapter and future 0.8 adapter can diverge
 * without leaking Hand internals into React features.
 */
export class HandGateway {
  async environment(): Promise<EnvironmentStatus> {
    return invoke("environment_validate");
  }

  async compatibility(): Promise<HandCompatibility> {
    return compatibilityFromEnvironment(await this.environment());
  }

  async assertMutationCompatible(): Promise<void> {
    assertHandMutationCompatible(await this.environment());
  }
}
