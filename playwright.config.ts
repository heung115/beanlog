import { defineConfig, devices } from "@playwright/test";
import { prepareQaArtifacts } from "./scripts/qa-artifact-hygiene.mjs";

const baseURL = process.env.QA_BASE_URL ?? "http://localhost:3100";
// Authenticated traces/videos can retain session material. Capture only for an
// explicit local investigation, and create resulting artifacts owner-private.
process.umask(0o077);
prepareQaArtifacts(process.cwd());
const captureArtifacts = process.env.QA_CAPTURE_ARTIFACTS === "1";

export default defineConfig({
  testDir: "./tests/qa",
  globalSetup: "./tests/qa/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "qa-report" }]],
  use: {
    baseURL,
    trace: captureArtifacts ? "retain-on-failure" : "off",
    screenshot: captureArtifacts ? "only-on-failure" : "off",
    video: captureArtifacts ? "retain-on-failure" : "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["iPhone 13"] }, grep: /@mobile/ },
  ],
});
