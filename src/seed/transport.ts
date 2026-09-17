import { SeedError } from "./private-files";

export type SeedAPI = (
  service: "gmail" | "hubspot",
  method: string,
  path: string,
  body?: unknown,
) => Promise<unknown>;
export function allowedSeedRequest(
  service: "gmail" | "hubspot",
  method: string,
  route: string,
) {
  if (
    !route.startsWith("/") ||
    route.startsWith("//") ||
    /[\r\n\\]/.test(route)
  )
    return false;
  const url = new URL(route, "https://seed.invalid");
  const p = url.pathname;
  if (service === "gmail") {
    if (method === "GET" && ["/profile", "/labels", "/messages"].includes(p))
      return p !== "/messages" || Boolean(url.searchParams.get("labelIds"));
    if (method === "GET" && /^\/messages\/[a-f0-9]+$/.test(p))
      return (
        url.searchParams.get("format") === "metadata" &&
        Boolean(url.searchParams.get("fields"))
      );
    if (method === "GET" && /^\/threads\/[a-f0-9]+$/.test(p))
      return (
        url.searchParams.get("format") === "minimal" &&
        url.searchParams.get("fields") === "id,messages(id,threadId)"
      );
    if (method === "POST" && p === "/messages")
      return (
        url.searchParams.get("internalDateSource") === "dateHeader" &&
        !url.searchParams.has("deleted")
      );
    return (
      (method === "POST" && p === "/labels") ||
      (method === "DELETE" && /^\/labels\/Label_[A-Za-z0-9_-]+$/.test(p))
    );
  }
  if (method === "POST" && p === "/oauth/v2/private-apps/get/access-token-info")
    return true;
  if (method === "GET" && p === "/crm/v3/pipelines/deals") return true;
  if (
    method === "GET" &&
    /^\/crm\/v3\/properties\/contacts\/[a-zA-Z0-9_]+$/.test(p)
  )
    return true;
  if (
    method === "GET" &&
    /^\/crm\/v4\/objects\/contacts\/\d+\/associations\/(companies|deals)$/.test(
      p,
    )
  )
    return true;
  if (/^\/crm\/v3\/objects\/(contacts|companies|deals)(\/\d+)?$/.test(p))
    return (
      method === "GET" ||
      (method === "POST" && !/\/\d+$/.test(p)) ||
      (method === "DELETE" && /\/\d+$/.test(p))
    );
  return (
    method === "PUT" &&
    /^\/crm\/v4\/objects\/contacts\/\d+\/associations\/default\/(companies|deals)\/\d+$/.test(
      p,
    )
  );
}
export function seedTransport(
  gmailToken: string,
  hubspotToken: string,
): SeedAPI {
  return async (service, method, route, body) => {
    if (!allowedSeedRequest(service, method, route))
      throw new SeedError("SEED_ENDPOINT_BLOCKED");
    const origin =
      service === "gmail"
        ? "https://gmail.googleapis.com/gmail/v1/users/me"
        : "https://api.hubapi.com";
    let response;
    try {
      response = await fetch(origin + route, {
        method,
        headers: {
          Authorization: `Bearer ${service === "gmail" ? gmailToken : hubspotToken}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
        redirect: "error",
        cache: "no-store",
      });
    } catch {
      throw new SeedError("SEED_NETWORK_RESULT_UNCERTAIN");
    }
    if (response.status === 404) throw new SeedError("SEED_NOT_FOUND");
    if (!response.ok)
      throw new SeedError(
        response.status === 401
          ? "SEED_AUTH_EXPIRED"
          : response.status === 403
            ? "SEED_SCOPE_DENIED"
            : "SEED_PROVIDER_REJECTED",
      );
    if (response.status === 204) return {};
    try {
      return await response.json();
    } catch {
      throw new SeedError("SEED_RESPONSE_INVALID");
    }
  };
}
