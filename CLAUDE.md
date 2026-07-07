# CLAUDE.md

## Specification (source of truth)

[SPEC.md](SPEC.md) drives spec-driven development: an index over per-area files in
[spec/](spec/), each grouping stable `REQ-*` IDs with a verification method. When behavior
changes, update the relevant `spec/` file **first** (and the index if an area is
added/removed), then the code, then re-verify. To validate the app, work through SPEC.md's
"How to verify" section and report PASS/FAIL/SKIP per `REQ-*`.

## Stack

**Node.js (>= 24) / TypeScript**, run directly from TS via Node's native type stripping — no
build step needed to run.

- Runtime deps: `prom-client` (metrics), `undici` (HTTP/TLS dispatcher for `fetch`),
  `commander` (flags), `parse-duration` (timeouts), `winston` (logging), `zod` (config
  validation), `vue` + `vuetify` (browser builds for the status UI on `/`).
- Dev deps: `typescript`, `vitest` (+ `@vitest/coverage-v8`), `eslint` v10 (flat config,
  [eslint.config.mjs](eslint.config.mjs)) with `typescript-eslint`, `prettier`.

## Commands

```bash
npm start                    # run (node --env-file=.env src/run.ts); needs public/ — run build:fe first
npm run dev                  # run with --watch
npm run build:fe             # assemble the status UI into public/ (git-ignored; required before start)
npm run build                # emit JS to dist/ (tsc)
npm run lint:ts              # tsc --noEmit
npm run lint:eslint          # eslint .ts + src/web/app.js
npm run lint:prettier        # prettier --check  (npm run format to fix)
npm run tests:unit           # vitest run
npm run tests:unit:coverage  # + coverage/: index.html, cobertura-coverage.xml, lcov.info (SonarQube)
```

After any change, `lint:ts`, `lint:eslint`, `lint:prettier`, and `tests:unit` must all pass.
Always run tests via these npm scripts — never `npx vitest` directly (bypasses configured
flags/reporters).

## Layout

Thin entrypoints (excluded from coverage): [run.ts](src/run.ts) (only place using commander —
parses flags → `loadConfig` → `main`) and [main.ts](src/main.ts) (`main(config)` wires
collaborators + starts the server). Core modules, each unit-tested:

- [exporter.ts](src/exporter.ts) — `Exporter` PBS API client + per-scrape metric collection (timeout/TLS dispatcher injected).
- [server.ts](src/server.ts) — HTTP layer: `/metrics` scrape, `/api/status` feed, static assets, `parseListenAddress`.
- [metrics.ts](src/metrics.ts) — `buildMetrics` (prom-client gauges), built fresh per scrape.
- [config.ts](src/config.ts) — `loadConfig`: resolves default→flag→env precedence, validates via the zod schema, returns typed `Config`.
- [configSchema.ts](src/configSchema.ts) — the zod `configSchema`; `Config = z.infer<typeof configSchema>`.
- [url.ts](src/url.ts) — `validateUrl` (SSRF guard), shared by the schema, `server.ts`, `exporter.ts`.
- [snapshotCache.ts](src/snapshotCache.ts) — opt-in per-target cache of `pbs_snapshot_*`, re-emitted on failed scrapes (see `REQ-SCRAPE-6`).
- [status.ts](src/status.ts) — in-memory per-target scrape-status store powering the UI.
- [log.ts](src/log.ts) — `createLogger(level, format)` winston factory; strips CR/LF centrally (see Security).
- [buildinfo.ts](src/buildinfo.ts) — build metadata (version/commit/build time).
- [src/web/](src/web) — status UI (`index.html` shell + `app.js`, Vue 3 + Vuetify 3), assembled into `public/` by [scripts/build-fe.mjs](scripts/build-fe.mjs).

Tests live in [src/__tests__/](src/__tests__) (`*.test.ts`, mirroring `src/`) with shared
fixtures in `pbs.fixtures.ts`; see [spec/testing.md](spec/testing.md) (`REQ-TEST-*`).

## TypeScript conventions

- **Relative imports use the `.ts` extension** (required by Node's TS execution; `tsconfig.json`
  enables `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`, rewritten to `.js` on build).
- Avoid constructs the type stripper rejects — TS `enum`, `namespace`, parameter properties;
  use plain types/interfaces and union literals.

## Configuration

Precedence **default → flag → env** (a non-empty `PBS_*` env var wins over the `--pbs.*` flag,
which wins over the default). Flags are declared with commander in [run.ts](src/run.ts);
[config.ts](src/config.ts) stays pure — resolves precedence into raw strings, then
validates/coerces via [configSchema.ts](src/configSchema.ts) into a typed `Config`, throwing one
error naming every offending field. No `*_FILE` secret support — pass secrets directly via
`PBS_*`. Authoritative list: `REQ-CFG-*` in [SPEC.md](SPEC.md).

## Security invariants

- **Log injection**: user-controlled values (resolved `target`, external error text) have CR/LF
  stripped before logging. Handled centrally in [log.ts](src/log.ts) as a winston format step, so
  call sites log values directly — no per-call sanitizing.
- **SSRF**: the attacker-influenceable endpoint/`?target=` is validated by `validateUrl()`
  ([url.ts](src/url.ts)) — must be an absolute `http(s)` URL. Configured `endpoint` validated at
  load (fatal); `?target=` per-request in [server.ts](src/server.ts) (HTTP 400, no scrape); and
  re-validated at the `fetch` boundary in [exporter.ts](src/exporter.ts). See `REQ-SEC-4`.
