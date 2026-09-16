import { ProviderError } from "@/providers/http";
export type RunStage = "connections" | "hubspot" | "gmail" | "storage";

// All output is owned copy. Never interpolate provider bodies, error messages, or identities.
export function safeRunError(error: unknown, stage: RunStage): string {
  const source =
    stage === "hubspot"
      ? "HubSpot"
      : stage === "gmail"
        ? "Gmail"
        : "Connection";
  if (error instanceof ProviderError) {
    if (error.status === 401 || error.code === "PROVIDER_AUTH")
      return `${source} authorization failed. Reconnect in Connections, then start a new run.`;
    if (error.status === 403)
      return `${source} access was denied. Check the read-only permissions and reconnect.`;
    if (error.status === 429 || error.code === "PROVIDER_RATE_LIMIT")
      return `${source} rate limit persisted after retries. Wait before starting a new run.`;
    if (error.code === "PROVIDER_NETWORK" || error.status >= 500)
      return `${source} was unavailable after retries. Check connectivity and try a new run later.`;
    if (error.code === "PAGINATION_LOOP")
      return `${source} returned inconsistent pagination. No complete export was published; try again later.`;
  }
  if (stage === "connections")
    return "Connections could not be loaded. Reconnect Gmail and HubSpot before starting a new run.";
  if (stage === "storage")
    return "Results could not be saved. Check the database and worker, then start a new run.";
  return `${source} data could not be fully validated. Check connection settings and try a new run. No complete export was published.`;
}
