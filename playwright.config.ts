/**
 * Playwright end-to-end test configuration.
 *
 * The e2e suite drives the real status UI in a browser (something the vitest
 * unit tests, which run against mocked `fetch` in Node, cannot do). Playwright
 * boots the exporter itself via `webServer` below — building the status-UI
 * frontend and starting the server with an empty endpoint (dynamic `?target=`
 * mode, so no live PBS is required) — then runs the specs under `e2e/`.
 *
 * Run with `npm run tests:e2e`. Kept separate from vitest: these are `*.spec.ts`
 * under `e2e/`, while vitest only globs `src/`+'/'+`**+/+*.test.ts`.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = 10_020;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Fail the run if a `test.only` is committed by accident.
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Build the frontend into public/, then start the exporter with no
    // configured endpoint so it boots without a reachable PBS.
    command: `npm run build:fe && node src/run.ts --pbs.listen-address 127.0.0.1:${PORT} --pbs.loglevel error`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 60_000,
  },
});
