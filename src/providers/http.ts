export class ProviderError extends Error {
  constructor(
    public code: string,
    public status: number = 0,
  ) {
    super(code);
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function fetchJson(
  url: string,
  init: RequestInit = {},
  safeToRetry = true,
): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(30000),
        cache: "no-store",
      });
    } catch {
      if (safeToRetry && attempt < 3) {
        await sleep(250 * 2 ** attempt);
        continue;
      }
      throw new ProviderError("PROVIDER_NETWORK");
    }
    if (response.ok) {
      try {
        return await response.json();
      } catch {
        throw new ProviderError("PROVIDER_INVALID_JSON");
      }
    }
    if (
      safeToRetry &&
      (response.status === 429 || response.status >= 500) &&
      attempt < 3
    ) {
      const retry = response.headers.get("retry-after");
      const seconds = retry ? Number(retry) : NaN;
      const delay = Number.isFinite(seconds)
        ? seconds * 1000
        : retry
          ? Date.parse(retry) - Date.now()
          : 250 * 2 ** attempt;
      await sleep(
        Math.min(30000, Math.max(100, Number.isFinite(delay) ? delay : 1000)) +
          Math.random() * 100,
      );
      continue;
    }
    throw new ProviderError(
      response.status === 401
        ? "PROVIDER_AUTH"
        : response.status === 429
          ? "PROVIDER_RATE_LIMIT"
          : "PROVIDER_REQUEST",
      response.status,
    );
  }
  throw new ProviderError("PROVIDER_RETRIES_EXHAUSTED");
}
