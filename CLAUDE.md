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
  [`parse-duration`](https://github.com/jkroso/parse-duration) (timeout duration parsing).
- Dev deps: `typescript`, `@types/node`, `vitest`, `@vitest/coverage-v8`.

### Layout

- [src/main.ts](src/main.ts) — entrypoint: HTTP server, PBS API client, metric collection.
- [src/config.ts](src/config.ts) — config loading (flags + env), pure and unit-tested.
- [src/config.test.ts](src/config.test.ts) — vitest unit tests for the config module.

## Commands

```bash
npm install                  # install dependencies
npm start                    # run the exporter (node --env-file=.env src/main.ts)
npm run dev                  # run with --watch for local development
npm run lint:ts              # type-check only (tsc --noEmit) — must exit 0
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
- After any change, both `npm run lint:ts` and `npm run tests:unit` must pass.

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
