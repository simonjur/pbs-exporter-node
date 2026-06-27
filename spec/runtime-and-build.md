# 2. Runtime & build

> Part of the [PBS Exporter specification](../SPEC.md). See the index for the
> spec-driven-development workflow and the meaning of **[offline-ok]** / **[needs-pbs]**.

| ID | Requirement | Verify |
|----|-------------|--------|
| REQ-RT-1 | Runs on Node.js >= 24 directly from TypeScript (native type stripping); no separate build step required to run. | `node src/main.ts --version` prints a version line and exits 0. **[offline-ok]** |
| REQ-RT-2 | Type-checks cleanly. | `npm run lint:ts` exits 0. **[offline-ok]** |
| REQ-RT-3 | Core runtime dependencies are `prom-client`, `undici`, `commander`, `parse-duration`, and `winston` (logging); the [status UI](status-ui.md) additionally vendors `vue` and `vuetify` (served as browser builds, not bundled). | Inspect `package.json` `dependencies`. **[offline-ok]** |
| REQ-RT-4 | Config-loading logic lives in [`src/config.ts`](../src/config.ts), separate from `main.ts`, so it can be unit-tested in isolation (see [Testing](testing.md), `REQ-TEST-*`). | Inspect the module structure: `config.ts` exports `loadConfig` and `main.ts` imports it. **[offline-ok]** |
| REQ-RT-6 | All `.ts` files lint cleanly under ESLint 10 (flat config in [`eslint.config.mjs`](../eslint.config.mjs), using `@eslint/js` + `typescript-eslint` recommended rules). | `npm run lint:eslint` exits 0. **[offline-ok]** |
| REQ-RT-7 | All `.ts` files conform to Prettier formatting. | `npm run lint:prettier` exits 0 (`npm run format` auto-fixes). **[offline-ok]** |
| REQ-RT-8 | `main.ts` is a thin entrypoint; the PBS API client and HTTP layer live in dedicated modules ([`src/exporter.ts`](../src/exporter.ts), [`src/server.ts`](../src/server.ts)) so they can be unit-tested in isolation (see [Testing](testing.md), `REQ-TEST-*`). | Inspect the module structure: `main.ts` wires collaborators it imports from `config.ts`, `exporter.ts`, and `server.ts`. **[offline-ok]** |
