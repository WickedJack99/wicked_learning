import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  testDir: './e2e',
  // The local Compose system is intentionally stateful: source-derived route
  // runs, invitations and strict credential limits belong to shared server
  // state. Run its browser acceptance checks serially rather than letting
  // concurrent workers reset another scenario's active route or spend the
  // same client-IP credential burst.
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
