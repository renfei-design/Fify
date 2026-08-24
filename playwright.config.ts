import { defineConfig, devices } from "@playwright/test";

const configuredBaseURL = process.env.FIFY_E2E_BASE_URL?.trim();
const baseURL = configuredBaseURL || "http://127.0.0.1:3101";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "eval-results/playwright-artifacts",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "eval-results/playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: configuredBaseURL
    ? undefined
    : {
        command: "node apps/demo/scripts/next-with-root-env.mjs dev -p 3101",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          FIFY_NEXT_DIST_DIR: ".next-e2e",
        },
      },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"], browserName: "chromium" },
    },
  ],
});
