# 13. Testing

> Part of the [PBS Exporter specification](../SPEC.md). See the index for the
> spec-driven-development workflow and the meaning of **[offline-ok]** / **[needs-pbs]**.

All automated tests for this project are **TypeScript unit tests run with
[vitest](https://vitest.dev)**. There is no separate compile step — vitest runs the
`.ts` test files directly (matching the project's native-type-stripping runtime).

| ID | Requirement | Verify |
|----|-------------|--------|
| REQ-TEST-1 | Unit tests are written in **TypeScript** and run with **vitest**, using the `*.test.ts` suffix. They are always invoked via the npm scripts — `npm run tests:unit` (and `npm run tests:unit:coverage` for coverage) — never by calling `npx vitest`/`vitest` directly, which would bypass the configured flags and reporters. | `npm run tests:unit` exits 0 with all tests passing. **[offline-ok]** |
| REQ-TEST-2 | All test files live under [`src/__tests__/`](../src/__tests__), mirroring the `src/` source layout; no `*.test.ts` file exists elsewhere under `src/`. Shared test helpers/fixtures live alongside them (e.g. [`src/__tests__/pbs.fixtures.ts`](../src/__tests__/pbs.fixtures.ts)). Vitest discovers them via `include: ["src/**/*.test.ts"]` in [`vitest.config.ts`](../vitest.config.ts). | `find src -name '*.test.ts' -not -path 'src/__tests__/*'` prints nothing; inspect `vitest.config.ts`. **[offline-ok]** |
| REQ-TEST-3 | Tests run fully **offline against mocked PBS responses** (the global `fetch` is stubbed) — no live PBS is required. The PBS API client ([`src/exporter.ts`](../src/exporter.ts)) and HTTP layer ([`src/server.ts`](../src/server.ts)) are driven by [`src/__tests__/exporter.test.ts`](../src/__tests__/exporter.test.ts) and [`src/__tests__/server.test.ts`](../src/__tests__/server.test.ts); config ([`src/config.ts`](../src/config.ts)) and the status store ([`src/status.ts`](../src/status.ts)) have their own unit tests. | `npm run tests:unit` passes with no PBS reachable. **[offline-ok]** |
| REQ-TEST-4 | `npm run tests:unit:coverage` generates coverage reports under `coverage/`: HTML (`index.html`), Cobertura XML (`cobertura-coverage.xml`, for GitHub) and LCOV (`lcov.info`, for SonarQube via `sonar.javascript.lcov.reportPaths`). Coverage measures product source only — `src/__tests__/**` and `src/main.ts` are excluded. | Run it; assert the three artifacts exist and the report lists no `src/__tests__/**` files. **[offline-ok]** |
