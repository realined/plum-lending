import { HubSpotProvider } from "@/providers/hubspot";
import { ProviderError } from "@/providers/http";

export type HubSpotCheckResult = { ok: boolean; message: string };
type HubSpotCheckEnv = Partial<
  Record<
    | "APP_MODE"
    | "HUBSPOT_PRIVATE_APP_TOKEN"
    | "HUBSPOT_SPONSOR_PROPERTY"
    | "HUBSPOT_SPONSOR_VALUE",
    string
  >
>;

// Deliberately independent of Gmail, the database, and the paid interpreter.
// Only fixed messages leave this boundary; never return provider data/errors.
export async function checkHubSpotConnection(
  env: HubSpotCheckEnv,
): Promise<HubSpotCheckResult> {
  const fail = (message: string): HubSpotCheckResult => ({
    ok: false,
    message,
  });
  if (env.APP_MODE !== "live")
    return fail("Set APP_MODE=live before invoking this live HubSpot check.");
  const token = env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  if (!token || token.startsWith("<") || /[\r\n]/.test(token))
    return fail("Fill HUBSPOT_PRIVATE_APP_TOKEN privately in .env first.");
  const property = env.HUBSPOT_SPONSOR_PROPERTY ?? "contact_type";
  if (!/^[a-zA-Z0-9_]+$/.test(property))
    return fail(
      "HUBSPOT_SPONSOR_PROPERTY must be a valid internal property name.",
    );
  try {
    await new HubSpotProvider(
      token,
      property,
      env.HUBSPOT_SPONSOR_VALUE ?? "Sponsor",
    ).validateConnection();
    return {
      ok: true,
      message:
        "HubSpot read-access check passed: contacts, Sponsor property, companies, deals, and pipelines. No records were written or stored. Account identity, associations, ingestion, and app connection status still require separate verification.",
    };
  } catch (error) {
    if (error instanceof ProviderError) {
      if (error.status === 401)
        return fail(
          "HubSpot rejected the token. Check or replace it privately in .env.",
        );
      if (error.status === 403)
        return fail(
          "HubSpot denied a required read. Review the private-app permissions in docs/live-setup.md.",
        );
      if (error.status === 404)
        return fail(
          "A required HubSpot resource was not found. Check the Sponsor property's internal name and account setup.",
        );
      if (error.code === "PROVIDER_NETWORK")
        return fail(
          "HubSpot could not be reached. Check the network and retry.",
        );
      if (error.status === 429)
        return fail("HubSpot rate-limited the check. Wait before retrying.");
    }
    return fail(
      "HubSpot read-access check failed. No credentials, provider content, or raw errors are displayed.",
    );
  }
}
