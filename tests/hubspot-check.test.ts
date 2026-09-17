import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkHubSpotConnection } from "@/server/hubspot-check";
import { HubSpotProvider } from "@/providers/hubspot";

const syntheticToken = "synthetic-credential-never-valid";
const privateMarker = "synthetic-provider-content-not-for-output";
const env = {
  APP_MODE: "live",
  HUBSPOT_PRIVATE_APP_TOKEN: syntheticToken,
};
const fetchMock = vi.fn<typeof fetch>();
const json = (status = 200) =>
  new Response(JSON.stringify({ results: [], privateMarker }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("explicit live HubSpot setup check", () => {
  it.each([
    { ...env, APP_MODE: "demo" },
    { ...env, APP_MODE: undefined },
    { ...env, HUBSPOT_PRIVATE_APP_TOKEN: "" },
    { ...env, HUBSPOT_PRIVATE_APP_TOKEN: "<private token>" },
    { ...env, HUBSPOT_PRIVATE_APP_TOKEN: "first\nsecond" },
    { ...env, HUBSPOT_SPONSOR_PROPERTY: "../../private" },
    { ...env, HUBSPOT_SPONSOR_PROPERTY: "" },
    { ...env, HUBSPOT_SPONSOR_PROPERTY: " contact_type " },
  ])(
    "rejects unsafe or incomplete configuration without network access: %#",
    async (input) => {
      expect((await checkHubSpotConnection(input)).ok).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("reuses only the five read checks, discards response content, and needs no other provider or database settings", async () => {
    fetchMock.mockImplementation(async () => json());
    const result = await checkHubSpotConnection({
      ...env,
      HUBSPOT_SPONSOR_PROPERTY: "lab_role",
    });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("still require separate verification");
    expect(JSON.stringify(result)).not.toContain(syntheticToken);
    expect(JSON.stringify(result)).not.toContain(privateMarker);
    expect(
      fetchMock.mock.calls.map(([input]) => new URL(String(input)).pathname),
    ).toEqual([
      "/crm/v3/objects/contacts",
      "/crm/v3/properties/contacts/lab_role",
      "/crm/v3/objects/companies",
      "/crm/v3/objects/deals",
      "/crm/v3/pipelines/deals",
    ]);
    for (const [input, init] of fetchMock.mock.calls) {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://api.hubapi.com");
      expect(init?.method ?? "GET").toBe("GET");
      expect(init?.body).toBeUndefined();
      expect(init?.headers).toEqual({
        Authorization: `Bearer ${syntheticToken}`,
      });
      if (url.pathname.startsWith("/crm/v3/objects/"))
        expect(url.searchParams.get("limit")).toBe("1");
    }
  });

  it.each([
    [401, "rejected the token"],
    [403, "denied a required read"],
    [404, "resource was not found"],
  ])(
    "reports HTTP %s safely and stops before further reads",
    async (status, message) => {
      fetchMock
        .mockResolvedValueOnce(json())
        .mockResolvedValueOnce(json(status));
      const result = await checkHubSpotConnection(env);
      expect(result.ok).toBe(false);
      expect(result.message).toContain(message);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(result)).not.toContain(syntheticToken);
      expect(JSON.stringify(result)).not.toContain(privateMarker);
    },
  );

  it("does not display a malformed response body", async () => {
    fetchMock.mockResolvedValue(new Response(privateMarker));
    const result = await checkHubSpotConnection(env);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(privateMarker);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("never exposes unexpected raw errors", async () => {
    vi.spyOn(HubSpotProvider.prototype, "validateConnection").mockRejectedValue(
      new Error(`${syntheticToken} ${privateMarker}`),
    );
    const result = await checkHubSpotConnection(env);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(syntheticToken);
    expect(JSON.stringify(result)).not.toContain(privateMarker);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
