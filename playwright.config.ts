import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.QA_BASE_URL ?? "http://localhost:3000";
const externalServer = process.env.QA_EXTERNAL_SERVER === "1";

export default defineConfig({
  testDir: "./tests/qa",
  globalSetup: "./tests/qa/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "qa-report" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] }, grep: /@mobile/ },
  ],
  webServer: externalServer
    ? undefined
    : {
        command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
        url: "http://localhost:3000/ko/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
