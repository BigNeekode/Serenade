import { SerenadeApiError, type EnvironmentStatus } from "@/types/domain";

export type HandCompatibilityMode = "supported" | "warning" | "unsupported";

export interface HandCompatibility {
  mode: HandCompatibilityMode;
  contract: "legacy-0.6" | "transition-0.7" | "v0.8-unadapted" | "unknown";
  mutationsAllowed: boolean;
  reason: string;
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

function parseVersion(raw?: string): ParsedVersion | null {
  if (!raw) return null;
  const match = raw.match(/(?:^|[^0-9])(\d+)\.(\d+)\.(\d+)(?:[^0-9]|$)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * Serenade's currently verified Hand contracts.
 *
 * 0.6 remains the production legacy adapter. 0.7 is the transition line we
 * intentionally support while moving supervision toward per-turn orient.
 * 0.8+ is read/diagnostics-only until a released 0.8 adapter is verified.
 */
export function classifyHandCompatibility(handVersion?: string): HandCompatibility {
  const version = parseVersion(handVersion);
  if (!version) {
    return {
      mode: "warning",
      contract: "unknown",
      mutationsAllowed: false,
      reason: "Could not identify the Hand version; Serenade will not issue workflow mutations.",
    };
  }

  if (version.major === 0 && version.minor === 6) {
    return {
      mode: "supported",
      contract: "legacy-0.6",
      mutationsAllowed: true,
      reason: "Verified legacy Hand 0.6 integration.",
    };
  }

  if (version.major === 0 && version.minor === 7) {
    return {
      mode: "supported",
      contract: "transition-0.7",
      mutationsAllowed: true,
      reason: "Supported transition contract; Supervisor should re-orient every reasoning turn.",
    };
  }

  if (version.major === 0 && version.minor >= 8) {
    return {
      mode: "warning",
      contract: "v0.8-unadapted",
      mutationsAllowed: false,
      reason: "Hand 0.8+ detected, but Serenade's canonical 0.8 adapter is not verified yet. Mutations are disabled.",
    };
  }

  if (version.major === 0 && version.minor < 6) {
    return {
      mode: "unsupported",
      contract: "unknown",
      mutationsAllowed: false,
      reason: "This Hand version predates Serenade's minimum supported 0.6 contract.",
    };
  }

  return {
    mode: "warning",
    contract: "unknown",
    mutationsAllowed: false,
    reason: "A newer or unknown Hand contract was detected. Mutations are disabled until compatibility is verified.",
  };
}

export function compatibilityFromEnvironment(env: EnvironmentStatus): HandCompatibility {
  if (!env.handFound) {
    return {
      mode: "unsupported",
      contract: "unknown",
      mutationsAllowed: false,
      reason: "Hand is not available.",
    };
  }
  return classifyHandCompatibility(env.handVersion);
}

export function assertHandMutationCompatible(env: EnvironmentStatus): void {
  const compatibility = compatibilityFromEnvironment(env);
  if (compatibility.mutationsAllowed) return;

  throw new SerenadeApiError({
    code: "UNSUPPORTED_CAPABILITY",
    title: "Hand contract not mutation-safe",
    message: compatibility.reason,
    detail: env.handVersion ? `Detected: ${env.handVersion}` : "Hand version unavailable",
    recoverable: true,
    suggestedAction:
      compatibility.contract === "v0.8-unadapted"
        ? "Use read-only Serenade views for now, or switch to a verified Hand 0.6/0.7 installation until the 0.8 adapter lands."
        : "Open Settings → Diagnostics and verify the configured Hand binary/version.",
  });
}
