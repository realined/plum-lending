import { startOAuth, finishOAuth } from "@/server/oauth";
import { api } from "@/server/api";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  authenticated,
  constantEqual,
  cookieOptions,
  readBody,
  requireAuth,
  requireOrigin,
  signSession,
} from "@/server/auth";
import { config } from "@/server/config";
import {
  googleAccessToken,
  liveProviders,
  saveConnection,
} from "@/server/connections";
import { decryptToken, encryptToken } from "@/server/crypto";
import { createDatabase, db, type Database } from "@/server/database";

// Guard the external database boundary; these tests must never contact a server.
vi.mock("postgres", () => ({
  default: vi.fn(() => {
    throw new Error("External PostgreSQL is forbidden in security unit tests");
  }),
}));

const now = Date.parse("2026-09-16T12:00:00.000Z");
const appUrl = "https://plum.example.test";
const fetchMock = vi.fn<typeof fetch>();
const singleton = globalThis as unknown as { plumDB?: Promise<Database> };
const previousSingleton = singleton.plumDB;
let database: Database;

function request(cookie?: string, origin: string | null = appUrl) {
  const headers = new Headers();
  if (cookie !== undefined) headers.set("cookie", `plum_session=${cookie}`);
  if (origin !== null) headers.set("origin", origin);
  return new NextRequest(`${appUrl}/api/jobs`, { headers });
}
function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
function validLiveConfig() {
  vi.stubEnv("APP_MODE", "live");
  vi.stubEnv("APP_URL", appUrl);
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://synthetic:synthetic@database.example.test/plum_test",
  );
  vi.stubEnv("ADMIN_PASSWORD", randomBytes(24).toString("base64url"));
  vi.stubEnv("SESSION_SECRET", randomBytes(32).toString("base64url"));
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
  vi.stubEnv("EMBEDDED_WORKER", "");
  vi.stubEnv("GMAIL_EXPECTED_MAILBOX", "lender@example.test");
  vi.stubEnv("GMAIL_DATA_SCOPE", "seed-only");
}
function flipEncodedByte(value: string) {
  const bytes = Buffer.from(value, "base64url");
  bytes[0] ^= 1;
  return bytes.toString("base64url");
}
const storedToken = (
  access = "synthetic-access-token",
  expiresAt = now + 3600_000,
) =>
  JSON.stringify({
    access_token: access,
    refresh_token: "synthetic-refresh-token",
    expires_at: expiresAt,
  });

beforeAll(async () => {
  database = await createDatabase(":memory:");
}, 30_000);
beforeEach(async () => {
  validLiveConfig();
  vi.spyOn(Date, "now").mockReturnValue(now);
  fetchMock.mockReset();
  fetchMock.mockRejectedValue(new Error("Unexpected network operation"));
  vi.stubGlobal("fetch", fetchMock);
  singleton.plumDB = Promise.resolve(database);
  await database.query("DELETE FROM connections");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  singleton.plumDB = previousSingleton;
});
afterAll(async () => {
  await database?.close();
});

describe("authenticated token encryption", () => {
  it("round-trips Unicode credentials with a fresh nonce for every encryption", () => {
    const plaintext = 'Synthetic token only: {"value":"café 🎋"}';
    const first = encryptToken(plaintext),
      second = encryptToken(plaintext);
    expect(first).not.toBe(second);
    expect(first).not.toContain(plaintext);
    expect(first.split(".")[0]).toBe("v1");
    expect(Buffer.from(first.split(".")[1], "base64url")).toHaveLength(12);
    expect(first.split(".")[1]).not.toBe(second.split(".")[1]);
    expect(decryptToken(first)).toBe(plaintext);
    expect(decryptToken(second)).toBe(plaintext);
  });
  it.each([1, 2, 3])(
    "rejects tampering with encrypted envelope component %i",
    (index) => {
      const parts = encryptToken("Synthetic credential").split(".");
      parts[index] = flipEncodedByte(parts[index]);
      expect(() => decryptToken(parts.join("."))).toThrow();
    },
  );
  it("rejects a different encryption key and malformed envelopes", () => {
    const ciphertext = encryptToken("Synthetic credential");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    expect(() => decryptToken(ciphertext)).toThrow();
    for (const malformed of ["", "plaintext", "v2.a.b.c", "v1..b.c", "v1.a..c"])
      expect(() => decryptToken(malformed)).toThrow();
  });
  it.each(["", "invalid-base64", Buffer.alloc(16).toString("base64")])(
    "rejects an absent or wrong-length key",
    (key) => {
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", key);
      expect(() => encryptToken("Synthetic credential")).toThrow(
        "TOKEN_KEY_REQUIRED",
      );
    },
  );
});

describe("live session authentication and request boundaries", () => {
  it("accepts an unexpired signature and expires it at the exact expiration instant", () => {
    const session = signSession(now + 1000);
    expect(authenticated(request(session))).toBe(true);
    expect(() => requireAuth(request(session))).not.toThrow();
    vi.mocked(Date.now).mockReturnValue(now + 1000);
    expect(authenticated(request(session))).toBe(false);
    expect(() => requireAuth(request(session))).toThrow(
      expect.objectContaining({ status: 401 }),
    );
  });
  it("rejects missing, malformed, modified, and incorrectly signed cookies", () => {
    const signed = signSession(now + 1000);
    const [expiration, signature] = signed.split(".");
    const badSignature = `${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
    for (const invalid of [
      undefined,
      "",
      "garbage",
      `${Number(expiration) + 1000}.${signature}`,
      `${expiration}.${badSignature}`,
      `${signed}.suffix`,
      "Infinity.invalid",
      "NaN.invalid",
    ])
      expect(authenticated(request(invalid))).toBe(false);
    vi.stubEnv("SESSION_SECRET", randomBytes(32).toString("base64url"));
    expect(authenticated(request(signed))).toBe(false);
  });
  it("keeps demo access explicit and compares credential strings without prefix acceptance", () => {
    expect(authenticated(request())).toBe(false);
    vi.stubEnv("APP_MODE", "demo");
    expect(authenticated(request())).toBe(true);
    expect(constantEqual("synthetic-pass", "synthetic-pass")).toBe(true);
    expect(constantEqual("synthetic-pass", "synthetic-pass-extra")).toBe(false);
    expect(constantEqual("synthetic-pass", "different-pass")).toBe(false);
  });
  it("requires an exact configured origin on mutations", () => {
    expect(() => requireOrigin(request())).not.toThrow();
    for (const origin of [
      null,
      "null",
      "https://other.example.test",
      `${appUrl}.other.example.test`,
      "http://plum.example.test",
    ])
      expect(() => requireOrigin(request(undefined, origin))).toThrow(
        expect.objectContaining({ status: 403 }),
      );
  });
  it("sets browser session cookies to HttpOnly, SameSite and Secure on HTTPS", () => {
    expect(cookieOptions()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 28_800,
    });
    vi.stubEnv("APP_URL", "http://localhost:3000");
    expect(cookieOptions().secure).toBe(false);
  });
  it("accepts JSON and rejects malformed, wrong-type, and oversized UTF-8 bodies", async () => {
    const bodyRequest = (
      body: string,
      headers: Record<string, string> = { "content-type": "application/json" },
    ) =>
      new NextRequest(`${appUrl}/api/segments`, {
        method: "POST",
        headers,
        body,
      });
    expect(await readBody(bodyRequest('{"query":"synthetic"}'))).toEqual({
      query: "synthetic",
    });
    await expect(readBody(bodyRequest("bad json"))).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      readBody(bodyRequest("{}", { "content-type": "text/plain" })),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      readBody(
        bodyRequest("{}", {
          "content-type": "application/json",
          "content-length": "12001",
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      readBody(bodyRequest(JSON.stringify({ data: "é".repeat(6000) }))),
    ).rejects.toMatchObject({ status: 413 });
  });
});

describe("live configuration and data isolation", () => {
  it.each([
    "",
    ":memory:",
    ".data/demo",
    "sqlite://local",
    "https://database.example.test",
    "postgres-pretend://example.test",
  ])("rejects a non-PostgreSQL live database URL: %s", (databaseUrl) => {
    vi.stubEnv("DATABASE_URL", databaseUrl);
    expect(() => config()).toThrow("Live mode requires DATABASE_URL.");
  });
  it("accepts PostgreSQL schemes, requires live secrets and HTTPS, and disables the embedded worker by default", () => {
    expect(config()).toEqual({ mode: "live", appUrl, embeddedWorker: false });
    vi.stubEnv(
      "DATABASE_URL",
      "postgres://synthetic:synthetic@database.example.test/plum_test",
    );
    expect(config().mode).toBe("live");
    vi.stubEnv("APP_URL", "http://plum.example.test");
    expect(() => config()).toThrow("Non-local live deployments require HTTPS.");
    vi.stubEnv("APP_URL", appUrl);
    vi.stubEnv("ADMIN_PASSWORD", "too-short");
    expect(() => config()).toThrow(/ADMIN_PASSWORD/);
  });
  it("uses an isolated demo database even when a PostgreSQL DATABASE_URL is present", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "plum-security-demo-"),
    );
    vi.stubEnv("APP_MODE", "demo");
    vi.stubEnv("DEMO_DATA_DIR", directory);
    delete singleton.plumDB;
    let isolated: Database | undefined;
    try {
      isolated = await db();
      expect(isolated).not.toBe(database);
      expect(
        await isolated.query("SELECT count(*)::int AS count FROM connections"),
      ).toEqual([{ count: 0 }]);
    } finally {
      await isolated?.close();
      delete singleton.plumDB;
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("connection ownership and token refresh fencing", () => {
  it("stores encrypted credentials and refuses to silently overwrite an existing connection", async () => {
    await saveConnection("gmail", storedToken(), "first@example.test");
    const [before] = await database.query<{
      encrypted_token: string;
      generation: string;
      mailbox: string;
    }>(
      "SELECT encrypted_token,generation,mailbox FROM connections WHERE id='gmail'",
    );
    expect(before.encrypted_token).not.toContain("synthetic-access-token");
    expect(decryptToken(before.encrypted_token)).toBe(storedToken());
    expect(before.generation).not.toBe("");
    await expect(
      saveConnection(
        "gmail",
        storedToken("different-synthetic-token"),
        "second@example.test",
      ),
    ).rejects.toThrow();
    expect(
      await database.query(
        "SELECT encrypted_token,generation,mailbox FROM connections WHERE id='gmail'",
      ),
    ).toEqual([before]);
  });
  it("uses a valid cached token and rejects a stale connection generation before network access", async () => {
    await saveConnection("gmail", storedToken(), "first@example.test");
    const [row] = await database.query<{ generation: string }>(
      "SELECT generation FROM connections WHERE id='gmail'",
    );
    expect(await googleAccessToken(row.generation)).toBe(
      "synthetic-access-token",
    );
    await expect(googleAccessToken("different-generation")).rejects.toThrow(
      "CONNECTION_CHANGED",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("refreshes an expired token without losing an omitted refresh token", async () => {
    await saveConnection(
      "gmail",
      storedToken("old-synthetic-access", now - 1000),
      "first@example.test",
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: "new-synthetic-access", expires_in: 3600 }),
    );
    expect(await googleAccessToken()).toBe("new-synthetic-access");
    const [row] = await database.query<{ encrypted_token: string }>(
      "SELECT encrypted_token FROM connections WHERE id='gmail'",
    );
    expect(JSON.parse(decryptToken(row.encrypted_token))).toEqual({
      access_token: "new-synthetic-access",
      refresh_token: "synthetic-refresh-token",
      expires_at: now + 3600_000,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init?.method).toBe("POST");
    expect((init?.body as URLSearchParams).get("grant_type")).toBe(
      "refresh_token",
    );
  });
  it("rejects a refresh result after the mailbox connection is replaced", async () => {
    await saveConnection(
      "gmail",
      storedToken("old-synthetic-access", now - 1000),
      "first@example.test",
    );
    let finishRefresh!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishRefresh = resolve;
        }),
    );
    const refresh = googleAccessToken();
    const rejected = expect(refresh).rejects.toThrow("CONNECTION_CHANGED");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await database.query("DELETE FROM connections WHERE id='gmail'");
    await saveConnection(
      "gmail",
      storedToken("replacement-synthetic-access"),
      "second@example.test",
    );
    finishRefresh(
      jsonResponse({ access_token: "stale-refresh-result", expires_in: 3600 }),
    );
    await rejected;
    expect(await googleAccessToken()).toBe("replacement-synthetic-access");
  });
  it("reuses a peer's successful refresh for the same connection generation", async () => {
    await saveConnection(
      "gmail",
      storedToken("old-synthetic-access", now - 1000),
      "first@example.test",
    );
    const finish: ((value: Response) => void)[] = [];
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish.push(resolve);
        }),
    );
    const first = googleAccessToken(),
      second = googleAccessToken();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    finish[0](
      jsonResponse({
        access_token: "winning-synthetic-access",
        expires_in: 3600,
      }),
    );
    expect(await first).toBe("winning-synthetic-access");
    finish[1](
      jsonResponse({
        access_token: "superseded-synthetic-access",
        expires_in: 3600,
      }),
    );
    expect(await second).toBe("winning-synthetic-access");
    expect(await googleAccessToken()).toBe("winning-synthetic-access");
  });
  it("fences a captured Gmail provider after reconnecting to a different mailbox", async () => {
    vi.stubEnv("GMAIL_DATA_SCOPE", "mailbox");
    vi.stubEnv("GMAIL_EXPECTED_MAILBOX", "first@example.test");
    await saveConnection("gmail", storedToken(), "first@example.test");
    await saveConnection("hubspot", "synthetic-hubspot-token");
    const providers = await liveProviders();
    await database.query("DELETE FROM connections WHERE id='gmail'");
    await saveConnection(
      "gmail",
      storedToken("replacement-synthetic-access"),
      "second@example.test",
    );
    await expect(providers.email.validateConnection()).rejects.toThrow(
      "CONNECTION_CHANGED",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Gmail OAuth start and callback using synthetic responses", () => {
  const scope = "https://www.googleapis.com/auth/gmail.readonly";
  beforeEach(() => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "synthetic-client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "synthetic-client-secret");
    vi.stubEnv(
      "GOOGLE_REDIRECT_URI",
      `${appUrl}/api/connections/gmail/callback`,
    );
  });
  function callback(
    cookie: string,
    state: string,
    extra = "code=synthetic-code",
  ) {
    return new NextRequest(
      `${appUrl}/api/connections/gmail/callback?state=${encodeURIComponent(state)}&${extra}`,
      {
        headers: {
          cookie: `plum_oauth=${cookie}; plum_session=${signSession()}`,
        },
      },
    );
  }
  function begin() {
    const response = startOAuth();
    const location = new URL(response.headers.get("location")!);
    const cookie = response.cookies.get("plum_oauth")!;
    const saved = JSON.parse(decryptToken(cookie.value));
    return { response, location, cookie, saved };
  }
  it("requires an authenticated administrator at both route boundaries", async () => {
    for (const path of ["start", "callback?code=synthetic-code"]) {
      const response = await api(
        new NextRequest(`${appUrl}/api/connections/gmail/${path}`),
      );
      expect(response.status).toBe(401);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("binds PKCE/state to an encrypted, narrow-path, ten-minute cookie", () => {
    const { location, cookie, saved } = begin();
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.searchParams.get("scope")).toBe(scope);
    expect(location.searchParams.get("login_hint")).toBe("lender@example.test");
    expect(location.searchParams.get("access_type")).toBe("offline");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("state")).toBe(saved.state);
    expect(location.searchParams.get("code_challenge")).toBe(
      createHash("sha256").update(saved.verifier).digest("base64url"),
    );
    expect(cookie).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/connections/gmail",
      maxAge: 600,
    });
    expect(saved.expires).toBe(now + 600000);
    expect(cookie.value).not.toContain(saved.verifier);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("exchanges a valid code, validates the mailbox, and persists only encrypted credentials", async () => {
    const { cookie, saved } = begin();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        access_token: "synthetic-access",
        refresh_token: "synthetic-refresh",
        expires_in: 3600,
        token_type: "Bearer",
        scope,
      }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ emailAddress: "lender@example.test", historyId: "123" }),
    );
    const response = await finishOAuth(callback(cookie.value, saved.state));
    expect(response.headers.get("location")).toBe(
      `${appUrl}/?connection=gmail-connected`,
    );
    expect(response.cookies.get("plum_oauth")?.maxAge).toBe(0);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = init?.body as URLSearchParams;
    expect(body.get("code_verifier")).toBe(saved.verifier);
    expect(body.get("redirect_uri")).toBe(
      `${appUrl}/api/connections/gmail/callback`,
    );
    const [row] = await database.query<{
      encrypted_token: string;
      mailbox: string;
    }>("SELECT encrypted_token,mailbox FROM connections WHERE id='gmail'");
    expect(row.mailbox).toBe("lender@example.test");
    expect(row.encrypted_token).not.toContain("synthetic-access");
    expect(JSON.parse(decryptToken(row.encrypted_token))).toMatchObject({
      access_token: "synthetic-access",
      refresh_token: "synthetic-refresh",
    });
  });
  it.each(["mismatched", "expired", "tampered", "denied"])(
    "rejects %s callback before token exchange",
    async (kind) => {
      const { cookie, saved } = begin();
      if (kind === "expired") saved.expires = now;
      const value =
        kind === "tampered"
          ? "invalid-cookie"
          : encryptToken(JSON.stringify(saved));
      const response = await finishOAuth(
        callback(
          kind === "mismatched" ? cookie.value : value,
          kind === "mismatched" ? "wrong-state" : saved.state,
          kind === "denied" ? "error=access_denied&code=ignored" : undefined,
        ),
      );
      expect(response.headers.get("location")).toBe(
        `${appUrl}/?connection=oauth-failed`,
      );
      expect(response.cookies.get("plum_oauth")?.maxAge).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await database.query("SELECT id FROM connections")).toEqual([]);
    },
  );
  it.each(["refresh", "scope", "profile", "token", "wrong-mailbox"])(
    "does not save a connection when %s validation fails",
    async (kind) => {
      const { cookie, saved } = begin();
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          access_token: "synthetic-access",
          ...(kind !== "refresh" ? { refresh_token: "synthetic-refresh" } : {}),
          expires_in: 3600,
          token_type: "Bearer",
          scope: kind === "scope" ? "unrelated" : scope,
        }),
      );
      if (kind === "token")
        fetchMock
          .mockReset()
          .mockResolvedValueOnce(
            new Response("Synthetic private error", { status: 400 }),
          );
      if (kind === "profile")
        fetchMock.mockResolvedValueOnce(
          jsonResponse({ emailAddress: "invalid", historyId: "123" }),
        );
      if (kind === "wrong-mailbox")
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            emailAddress: "unapproved@example.test",
            historyId: "123",
          }),
        );
      const response = await finishOAuth(callback(cookie.value, saved.state));
      expect(response.headers.get("location")).toBe(
        `${appUrl}/?connection=oauth-failed`,
      );
      expect(await database.query("SELECT id FROM connections")).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(
        ["profile", "wrong-mailbox"].includes(kind) ? 2 : 1,
      );
    },
  );
  it("rejects a callback path mismatch before generating authorization", () => {
    vi.stubEnv("GOOGLE_REDIRECT_URI", `${appUrl}/wrong-path`);
    expect(() => startOAuth()).toThrow("must match");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requires an explicit mailbox identity before starting OAuth", () => {
    vi.stubEnv("GMAIL_EXPECTED_MAILBOX", "");
    expect(() => startOAuth()).toThrow("SEED_DATA_BOUNDARY");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
