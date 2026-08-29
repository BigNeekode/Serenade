import { useMemo } from "react";
import { useApi } from "@/lib/api";
import { InteractionGateway } from "@/lib/interaction/gateway";

/**
 * Shared operator-interaction boundary for feature hooks/components.
 * Reads remain on SerenadeApi; reasoning and exact workflow actions go through
 * InteractionGateway so the distinction stays visible at call sites.
 */
export function useInteraction(): InteractionGateway {
  const api = useApi();
  return useMemo(() => new InteractionGateway(api), [api]);
}
