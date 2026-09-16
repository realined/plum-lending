import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_QUERY, parseDemo } from "@/domain/segment";
import { interpret } from "@/server/parser";
const { parse, constructor } = vi.hoisted(() => ({
  parse: vi.fn(),
  constructor: vi.fn(),
}));
vi.mock("openai", () => ({
  default: class {
    responses = { parse };
    constructor(options: unknown) {
      constructor(options);
    }
  },
}));
vi.mock("@/server/config", () => ({
  config: () => ({ mode: process.env.APP_MODE ?? "demo" }),
}));
const intent = {
  supported: true,
  role: "Sponsor",
  lookbackMonths: 24,
  excludeRecentMonths: 3,
  direction: "inbound",
  dealPolicy: "no_closed_won",
  clarification: null,
};
beforeEach(() => {
  vi.stubEnv("APP_MODE", "live");
  vi.stubEnv("OPENAI_API_KEY", "synthetic-key");
  parse.mockReset();
  constructor.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected real network operation");
    }),
  );
  vi.useFakeTimers();
  vi.setSystemTime("2026-09-16T12:00:00.000Z");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("live interpretation boundary with a mocked OpenAI SDK", () => {
  it("sends only the query and schema, disables storage, and freezes deterministic dates", async () => {
    parse.mockResolvedValue({
      status: "completed",
      output: [],
      output_parsed: intent,
    });
    const result = await interpret(DEFAULT_QUERY);
    expect(result.spec).toEqual(parseDemo(DEFAULT_QUERY));
    expect(result.source).toBe("OpenAI structured output");
    const request = parse.mock.calls[0][0];
    expect(request).toMatchObject({
      store: false,
      max_output_tokens: 1000,
      text: { format: { type: "json_schema", strict: true } },
    });
    expect(request.input).toHaveLength(2);
    expect(request.input[1]).toEqual({ role: "user", content: DEFAULT_QUERY });
    expect(request.tools).toBeUndefined();
    expect(constructor).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 30000, maxRetries: 1 }),
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["incomplete", "failed", "in_progress"])(
    "rejects %s responses even if parsed output is present",
    async (status) => {
      parse.mockResolvedValue({ status, output: [], output_parsed: intent });
      await expect(interpret(DEFAULT_QUERY)).rejects.toThrow(
        "could not be interpreted",
      );
    },
  );
  it("handles refusal without reflecting model text", async () => {
    parse.mockResolvedValue({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            { type: "refusal", refusal: "Synthetic untrusted refusal" },
          ],
        },
      ],
      output_parsed: null,
    });
    await expect(interpret(DEFAULT_QUERY)).rejects.toThrow(
      "declined this request",
    );
  });
  it.each([
    null,
    { ...intent, role: "Lender" },
    { ...intent, sql: "DROP TABLE" },
    { ...intent, excludeRecentMonths: 24 },
  ])(
    "rejects missing, malformed, extra-field or invalid-window output",
    async (output_parsed) => {
      parse.mockResolvedValue({
        status: "completed",
        output: [],
        output_parsed,
      });
      await expect(interpret(DEFAULT_QUERY)).rejects.toThrow();
    },
  );
  it("rejects unsupported conditions instead of dropping them", async () => {
    parse.mockResolvedValue({
      status: "completed",
      output: [],
      output_parsed: { ...intent, supported: false },
    });
    await expect(interpret(DEFAULT_QUERY)).rejects.toThrow(
      "This slice supports",
    );
  });
  it("sanitizes transport errors and refuses missing configuration before API use", async () => {
    parse.mockRejectedValue(
      new Error("Synthetic provider body with secret data"),
    );
    await expect(interpret(DEFAULT_QUERY)).rejects.toThrow(
      "AI service could not complete",
    );
    parse.mockClear();
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(interpret(DEFAULT_QUERY)).rejects.toThrow(
      "Configure OPENAI_API_KEY",
    );
    expect(parse).not.toHaveBeenCalled();
  });
  it("never initializes the SDK in demo mode", async () => {
    vi.stubEnv("APP_MODE", "demo");
    expect((await interpret(DEFAULT_QUERY)).source).toBe("demo rules");
    expect(constructor).not.toHaveBeenCalled();
  });
});
