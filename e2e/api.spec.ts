import { test, expect } from "@playwright/test";
const query =
  "Pull all Sponsor contacts who have sent emails to the lender in the last 2 years minus the last 3 months and have not closed a deal in HubSpot.";
const headers = { origin: "http://localhost:3100" };
test("production API reviews, persists, executes and streams compatible CSV", async ({
  request,
}) => {
  const interpreted = await request.post("/api/interpret", {
    headers,
    data: { query },
  });
  expect(interpreted.status()).toBe(200);
  const segment = await interpreted.json();
  expect(segment.spec.startInclusive).toBe("2024-09-16T12:00:00.000Z");
  const created = await request.post("/api/jobs", {
    headers,
    data: { segmentId: segment.id },
  });
  expect(created.status()).toBe(202);
  const { id } = await created.json();
  await expect
    .poll(
      async () => {
        const r = await request.get(`/api/jobs/${id}`);
        return (await r.json()).job.status;
      },
      { timeout: 20000 },
    )
    .toBe("succeeded");
  const response = await request.get(`/api/jobs/${id}`);
  const value = await response.json();
  expect(value.totalRows).toBe(4);
  expect(value.job.counts).toMatchObject({
    contacts: 3,
    threads: 4,
    messages: 11,
    excluded: 5,
    failures: 0,
  });
  expect(value.job).not.toHaveProperty("lease_owner");
  const csv = await request.get(`/api/jobs/${id}/csv`);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(csv.headers()["content-disposition"]).toContain("attachment;");
  expect(csv.headers()["cache-control"]).toBe("no-store");
  const text = await csv.text();
  expect(text).toContain(
    '"Email Subject","Email Body","Account Name","First Name","Last Name","Email","Last Activity Date","Raw Communication Data"',
  );
  expect(text).toContain("Our timing has moved to Q4");
  expect(text).toContain("2024-08-20T10:00:00.000Z");
  const again = await request.post("/api/jobs", {
    headers,
    data: { segmentId: segment.id },
  });
  expect((await again.json()).id).toBe(id);
});
test("production API handles partial, empty, and outage without claiming completeness", async ({
  request,
}) => {
  for (const [scenario, status, totalRows] of [
    ["partial", "partial", 3],
    ["empty", "succeeded", 0],
    ["outage", "failed", 0],
  ] as const) {
    const segment = await (
      await request.post("/api/interpret", { headers, data: { query } })
    ).json();
    const { id } = await (
      await request.post("/api/jobs", {
        headers,
        data: { segmentId: segment.id, scenario },
      })
    ).json();
    await expect
      .poll(
        async () => {
          const r = await request.get(`/api/jobs/${id}`);
          return (await r.json()).job.status;
        },
        { timeout: 20000 },
      )
      .toBe(status);
    const value = await (await request.get(`/api/jobs/${id}`)).json();
    expect(value.totalRows).toBe(totalRows);
    const csv = await request.get(`/api/jobs/${id}/csv`);
    expect(csv.status()).toBe(status === "failed" ? 409 : 200);
    if (scenario === "partial") expect(value.job.failures).toHaveLength(1);
  }
});
test("API rejects hostile origins, invalid specs, unsupported language, missing results and oversized input", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/interpret", {
        headers: { origin: "https://untrusted.example.test" },
        data: { query },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/jobs", {
        headers,
        data: { segmentId: "invalid", spec: { sql: "drop" } },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/interpret", {
        headers,
        data: {
          query:
            "Find contacts whose company has more than ten million in revenue",
        },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await request.get("/api/jobs/00000000-0000-4000-8000-000000000000")
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.post("/api/interpret", {
        headers,
        data: { query: "a".repeat(13000) },
      })
    ).status(),
  ).toBe(413);
});

test("setup status contains configuration flags rather than secret values", async ({
  request,
}) => {
  const response = await request.get("/api/status");
  const status = await response.json();
  expect(status.mode).toBe("demo");
  expect(status.setup.map((check: { id: string }) => check.id)).toEqual([
    "database",
    "security",
    "google",
    "gmail-data",
    "openai",
  ]);
  for (const check of status.setup) {
    expect(typeof check.configured).toBe("boolean");
    expect(Object.keys(check).sort()).toEqual([
      "configured",
      "detail",
      "id",
      "label",
    ]);
  }
});
