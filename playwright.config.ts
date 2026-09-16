import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 15000 },
  reporter: "list",
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  webServer: {
    command: "pnpm start --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      APP_MODE: "demo",
      APP_URL: "http://localhost:3100",
      DEMO_DATA_DIR: `.data/e2e-${process.pid}`,
      DATABASE_URL: "",
      EMBEDDED_WORKER: "true",
      OPENAI_API_KEY: "",
      HUBSPOT_PRIVATE_APP_TOKEN: "",
    },
  },
});
