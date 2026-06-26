# PBS Exporter — Specification

> **Spec-driven development.** This document set is the source of truth for what the
> exporter must do. The implementation — a thin entrypoint [`src/main.ts`](src/main.ts)
> with logic split across `config.ts`, `exporter.ts` (PBS client), `server.ts` (HTTP
> layer), `metrics.ts`, `status.ts` and `log.ts` — is verified *against* this spec, not
> the other way around. Each requirement has a stable ID and a verification method an
> agent (or human) can execute. When behavior changes, update the spec **first**, then
> the code, then re-verify.

This file is the index. The requirements themselves live in per-area files under
[`spec/`](spec/); every `REQ-*` ID is globally unique across those files.

## How to verify

An agent verifies a requirement by executing its **Verify** step and confirming the
observable outcome. Where a live Proxmox Backup Server is unavailable, requirements
are marked **[offline-ok]** (verifiable without a real PBS) or **[needs-pbs]**
(requires a reachable PBS or a stub returning the documented JSON).

Build/run baseline:

```bash
npm install
npm run lint:ts          # MUST exit 0
PBS_LISTEN_ADDRESS=":19099" node src/main.ts
```

Produce a report mapping every `REQ-*` ID to PASS / FAIL / SKIP with the evidence
(command output) for each.

---

## 1. Purpose

The exporter exposes Proxmox Backup Server (PBS) metrics in Prometheus text format
over HTTP. It is a faithful TypeScript/Node.js port of the original Go exporter and
MUST preserve metric names, labels, and help strings.

---

## Areas

| # | Area | Requirements |
|---|------|--------------|
| 2 | [Runtime & build](spec/runtime-and-build.md) | `REQ-RT-*` |
| 3 | [Configuration](spec/configuration.md) | `REQ-CFG-*` |
| 4 | [HTTP server](spec/http-server.md) | `REQ-HTTP-*` |
| 5 | [Scrape lifecycle](spec/scrape-lifecycle.md) | `REQ-SCRAPE-*` |
| 6 | [PBS API calls](spec/pbs-api-calls.md) | `REQ-API-*` |
| 7 | [Metrics](spec/metrics.md) | `REQ-M-*` |
| 8 | [Behavioral rules](spec/behavioral-rules.md) | `REQ-B-*` |
| 9 | [TLS & security](spec/tls-and-security.md) | `REQ-SEC-*` |
| 10 | [Node.js runtime metrics](spec/nodejs-runtime-metrics.md) | `REQ-NODE-*` |
| 11 | [Container image & release](spec/container-image-and-release.md) | `REQ-IMG-*`, `REQ-REL-*` |
| 12 | [Status UI](spec/status-ui.md) | `REQ-UI-*` |
