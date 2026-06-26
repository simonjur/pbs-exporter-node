# CLAUDE.md

## Specification (source of truth)

[SPEC.md](SPEC.md) is the spec-driven-development source of truth for what the
exporter must do. Each requirement has a stable `REQ-*` ID and a verification method.
When behavior changes, update SPEC.md **first**, then the code, then re-verify against
it. To check the app does what it's supposed to, work through SPEC.md's "How to verify"
section and report PASS/FAIL/SKIP per requirement ID.

## Stack

This project is a **Node.js (>= 24) / TypeScript** application. It is run directly from
TypeScript via Node's native type stripping — there is no required build step to run it.

- Runtime deps: [`prom-client`](https://github.com/siimon/prom-client) (metrics),
  [`undici`](https://github.com/nodejs/undici) (HTTP/TLS dispatcher for `fetch`),
  [`commander`](https://github.com/tj/commander.js) (flag parsing),
  [`parse-duration`](https://github.com/jkroso/parse-duration) (timeout duration parsing),
  [`winston`](https://github.com/winstonjs/winston) (logging),
  [`vue`](https://vuejs.org) + [`vuetify`](https://vuetifyjs.com) (browser builds vendored
  from `node_modules` to serve the status UI on `/` — not bundled, no build step).
- Dev deps: `typescript`, `@types/node`, `vitest`, `@vitest/coverage-v8`,
  `eslint` (v10, flat config), `@eslint/js`, `typescript-eslint`, `prettier`.

### Layout

- [src/main.ts](src/main.ts) — entrypoint only: loads config, wires collaborators,
  starts the HTTP server. Thin and excluded from coverage.
- [src/exporter.ts](src/exporter.ts) — the `Exporter` PBS API client and per-scrape metric
  collection (timeout + TLS dispatcher injected); unit-tested.
- [src/exporter.test.ts](src/exporter.test.ts) — vitest tests driving the exporter with
  mocked PBS responses (`fetch` stubbed).
- [src/server.ts](src/server.ts) — HTTP layer: `/metrics` scrape, `/api/status` feed, static
  asset serving, `parseListenAddress`; unit-tested.
- [src/server.test.ts](src/server.test.ts) / [src/server.assets.test.ts](src/server.assets.test.ts) — vitest tests for the HTTP layer.
- [src/metrics.ts](src/metrics.ts) — `buildMetrics` (prom-client gauge definitions), built fresh per scrape.
- [src/log.ts](src/log.ts) — winston logger with selectable output (`text` → `LEVEL: message`, `json` → one JSON object per line), log-level/format accessors, and the `sanitize` log-injection guard.
- [src/buildinfo.ts](src/buildinfo.ts) — build metadata (version/commit/build time).
- [src/pbs.fixtures.ts](src/pbs.fixtures.ts) — mock PBS API responses + test helpers (`makeFetchMock`, `metricValue`).
- [src/config.ts](src/config.ts) — config loading (flags + env), pure and unit-tested.
- [src/config.test.ts](src/config.test.ts) — vitest unit tests for the config module.
- [src/status.ts](src/status.ts) — in-memory per-target scrape-status store powering the UI; unit-tested.
- [src/status.test.ts](src/status.test.ts) — vitest unit tests for the status store.
- [src/web/](src/web) — status UI: `index.html` shell + `app.js` (Vue 3 + Vuetify 3, no build step).

## Commands

```bash
npm install                  # install dependencies
npm start                    # run the exporter (node --env-file=.env src/main.ts)
npm run dev                  # run with --watch for local development
npm run lint:ts              # type-check only (tsc --noEmit) — must exit 0
npm run lint:eslint          # lint all .ts files with ESLint 10 — must exit 0
npm run lint:prettier        # check formatting of all .ts files — must exit 0
npm run format               # auto-fix formatting with Prettier (--write)
npm run tests:unit           # run vitest unit tests
npm run tests:unit:coverage  # run tests + write coverage/ reports (html, cobertura xml, lcov)
npm run build                # emit JS to dist/ (tsc)
```

Coverage reports land in `coverage/`:
- `index.html` — human-browsable report
- `cobertura-coverage.xml` — generic XML for GitHub coverage actions
- `lcov.info` — for SonarQube (`sonar.javascript.lcov.reportPaths=coverage/lcov.info`)

## TypeScript conventions

- **Relative imports use the `.ts` extension** (e.g. `import { loadConfig } from "./config.ts"`).
  This is required by Node's native TypeScript execution. `tsconfig.json` enables
  `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`, so `tsc` type-checks
  these and rewrites them to `.js` on `npm run build`.
- Avoid constructs the type stripper can't handle (TS `enum`, `namespace`, parameter
  properties). Use plain types/interfaces and union literals.
- After any change, `npm run lint:ts`, `npm run lint:eslint`, `npm run lint:prettier`,
  and `npm run tests:unit` must all pass. ESLint uses a flat config
  ([eslint.config.mjs](eslint.config.mjs), v10) with `typescript-eslint`; Prettier
  formatting is enforced in CI — run `npm run format` to fix style locally.

## Configuration

Flags (commander) and environment variables; precedence is default → flag → env.
See `loadConfig` in [src/config.ts](src/config.ts) and the `REQ-CFG-*` requirements in
[SPEC.md](SPEC.md) for the authoritative list. Secret values can be supplied via
`*_FILE` env vars (first line of the file is read).

## Security — log injection

Any user-controlled value (e.g. the resolved `target` endpoint) must be stripped of
CR/LF before being logged, to prevent log-injection. Use the `sanitize()` helper in
[src/main.ts](src/main.ts) (it `replaceAll`s `\n` and `\r`) for anything originating
from request input or external responses.

## Legacy Go code (pending removal)

The repository still contains the original Go implementation and its tooling — `main.go`,
`go.mod`/`go.sum`, the `Makefile`, and the Go-oriented GitHub workflows / pre-commit hooks.
These are **superseded by the TypeScript app** and kept only until a later cleanup. Do not
treat them as the current source of truth; the Node/TypeScript code above is authoritative.
