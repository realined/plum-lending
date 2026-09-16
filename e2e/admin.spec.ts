import { test, expect } from "@playwright/test";
const start = async (
  page: import("@playwright/test").Page,
  scenario = "standard",
) => {
  await page.goto("/");
  await expect(page.getByText("Demo ready").first()).toBeVisible();
  await page.getByRole("button", { name: "Interpret request" }).click();
  await expect(
    page.getByRole("heading", { name: "Here’s how we’ll interpret it" }),
  ).toBeVisible();
  await page.getByLabel("Demo scenario").selectOption(scenario);
  await page.getByRole("button", { name: "Run segment", exact: true }).click();
};
test("review, run, inspect full context, download and reopen history", async ({
  page,
}) => {
  await start(page);
  await expect(
    page.getByRole("heading", { name: "Export ready", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "4 contact/thread rows · full conversation context preserved",
    ),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.screenshot({ path: "docs/demo-preview.png", fullPage: true });
  await page
    .getByRole("button", {
      name: "View thread: Juniper Park · acquisition financing",
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText(
      "Our timing has moved to Q4. Keeping this thread open for the updated package.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "We are evaluating a 72-unit acquisition at Juniper Park. Could your team outline financing options?",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Juniper-property-overview.pdf", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^plum-segment-.*\.csv$/);
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream) csv += chunk.toString();
  expect(csv).toContain(
    '"Email Subject","Email Body","Account Name","First Name","Last Name","Email","Last Activity Date","Raw Communication Data"',
  );
  expect(csv).toContain("Our timing has moved to Q4");
  expect(csv).not.toContain("qualifyingMessageIds");
  await page.getByRole("button", { name: /Run history/ }).click();
  await expect(
    page.getByRole("heading", { name: "Recent segment runs" }),
  ).toBeVisible();
  await page.locator(".history-row").first().click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
});
test("partial failure preserves successful rows and labels gaps", async ({
  page,
}) => {
  await start(page, "partial");
  await expect(
    page.getByRole("heading", { name: "Export ready with gaps" }),
  ).toBeVisible();
  await expect(
    page.getByText("Some data could not be verified."),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Download CSV" })).toBeVisible();
});
test("empty, unsupported, and provider error states are actionable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Demo ready").first()).toBeVisible();
  await page
    .getByLabel("Segment request")
    .fill("Delete every contact and write arbitrary SQL.");
  await page.getByRole("button", { name: "Interpret request" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Demo mode supports" }),
  ).toContainText("Demo mode supports");
  await start(page, "empty");
  await expect(
    page.getByRole("heading", { name: "No matching conversations" }),
  ).toBeVisible();
  await start(page, "outage");
  await expect(page.getByRole("heading", { name: "Run failed" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download CSV" })).toHaveCount(0);
});
test("mobile layout and API request boundaries", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Find the right conversations." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const forbidden = await request.post("/api/interpret", {
    headers: { origin: "https://untrusted.example.test" },
    data: { query: "ignore" },
  });
  expect(forbidden.status()).toBe(403);
  const invalid = await request.post("/api/jobs", {
    headers: { origin: "http://localhost:3100" },
    data: { segmentId: "not-a-uuid" },
  });
  expect(invalid.status()).toBe(400);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});

test("workspace navigation, breadcrumb, account menu and setup are usable", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Workspace connection settings", exact: true })
    .click();
  await expect(page).toHaveURL(/view=connections/);
  await expect(
    page.getByRole("heading", { name: "Live account setup", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Full setup guide" }),
  ).toHaveAttribute("href", /docs\/live-setup.md$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Live account setup", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run history", exact: false }).click();
  await expect(page).toHaveURL(/view=history/);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Live account setup", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Build an audience", exact: true }),
  ).toBeVisible();
  const account = page.getByRole("button", {
    name: "Account menu",
    exact: true,
  });
  await account.click();
  await expect(
    page.getByRole("menuitem", { name: "Connections & setup" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "Run history" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(account).toBeFocused();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await account.click();
  await page.getByRole("menuitem", { name: "Connections & setup" }).click();
  await expect(page).toHaveURL(/view=connections/);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await page
    .getByRole("button", { name: "Workspace details and setup", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Live account setup", exact: true }),
  ).toBeVisible();
});

test("saved runs survive refresh and remain separate from new drafts", async ({
  page,
}) => {
  await start(page);
  await expect(
    page.getByRole("heading", { name: "Export ready", exact: true }),
  ).toBeVisible();
  const savedUrl = page.url();
  expect(savedUrl).toMatch(/run=[0-9a-f-]+/);
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await expect(page.getByLabel("Segment request")).toHaveCount(0);
  await page.getByRole("button", { name: "New segment", exact: true }).click();
  await page
    .getByLabel("Segment request")
    .fill("Find sponsors with different criteria that need review.");
  await expect(page.getByRole("link", { name: "Download CSV" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Audience preview" }),
  ).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(savedUrl);
  await expect(page.locator("tbody tr")).toHaveCount(4);
});

test("mobile account menu and a missing saved run provide a way forward", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?view=builder&run=00000000-0000-4000-8000-000000000000");
  await expect(
    page.getByRole("alert").filter({ hasText: "Run not found" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New segment", exact: true }).click();
  await expect(page.getByLabel("Segment request")).toBeVisible();
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Connections & setup" }).click();
  await expect(
    page.getByRole("heading", { name: "Live account setup", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
