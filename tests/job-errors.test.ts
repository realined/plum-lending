import { describe, expect, it } from "vitest";
import { ProviderError } from "@/providers/http";
import { safeRunError, type RunStage } from "@/server/job-errors";
describe("safe recovery messages", () => {
  it.each([
    [401, "Reconnect"],
    [403, "permissions"],
    [429, "rate limit"],
    [503, "unavailable"],
  ])(
    "categorizes provider status %i without echoing provider content",
    (status, expected) => {
      const result = safeRunError(
        new ProviderError("synthetic private data", status as number),
        "hubspot",
      );
      expect(result).toContain("HubSpot");
      expect(result).toContain(expected);
      expect(result).not.toContain("synthetic");
    },
  );
  it.each<RunStage>(["connections", "hubspot", "gmail", "storage"])(
    "does not reflect arbitrary errors in %s",
    (stage) => {
      expect(
        safeRunError(new Error("synthetic token + correspondence"), stage),
      ).not.toContain("synthetic");
    },
  );
  it("identifies repeated pagination and exhausted network retries", () => {
    expect(
      safeRunError(new ProviderError("PAGINATION_LOOP"), "gmail"),
    ).toContain("pagination");
    expect(
      safeRunError(new ProviderError("PROVIDER_NETWORK"), "gmail"),
    ).toContain("unavailable");
  });
});
