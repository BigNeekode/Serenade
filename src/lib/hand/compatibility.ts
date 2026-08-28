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
 * 0.6 is the only released contract verified end-to-end by Serenade today.
 * 0.7 is an intentional transition target, but remains mutation-blocked until
 * its release is tested against Serenade. 0.8+ likewise stays
 * read/diagnostics-only until its canonical adapter is verified.
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
      mode: "warning",
      contract: "transition-0.7",
      mutationsAllowed: false,
      reason: "Hand 0.7 transition contract detected. Serenade will re-orient correctly, but workflow mutations stay disabled until the released 0.7 contract is verified.",
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
      compatibility.contract === "legacy-0.6"
        ? "Open Settings → Diagnostics and verify the configured Hand installation."
        : "Use Serenade's read-only views for now, or switch to the verified Hand 0.6 release until this contract is qualified.",
  });
}
