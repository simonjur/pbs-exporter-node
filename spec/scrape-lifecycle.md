# 5. Scrape lifecycle

> Part of the [PBS Exporter specification](../SPEC.md). See the index for the
> spec-driven-development workflow and the meaning of **[offline-ok]** / **[needs-pbs]**.

A "scrape" is request-driven: each `GET <metrics-path>` triggers exactly one PBS
collection for the resolved target. The exporter has **no internal timer or background
polling loop** — scrape frequency is determined solely by the client (e.g. Prometheus
`scrape_interval`). All "per scrape" requirements below describe what happens during one
such request.

| ID | Requirement | Verify |
|----|-------------|--------|
| REQ-SCRAPE-0 | A scrape is performed on demand: each `GET <metrics-path>` triggers exactly one PBS collection for the resolved target. The exporter runs no internal scheduler/timer; with no client requests it makes no PBS API calls. | With no requests, no PBS API calls occur (debug log is silent); each `/metrics` request produces exactly one collection. **[offline-ok]** |
| REQ-SCRAPE-1 | PBS metrics are built on a **fresh registry per scrape**, so labels that disappear between scrapes are not retained as stale series. | Two scrapes against different targets do not accumulate each other's datastore label series. **[needs-pbs]** |
| REQ-SCRAPE-2 | On a fully successful collection, `pbs_up` = 1. | `GET /metrics` against a working PBS → `pbs_up 1`. **[needs-pbs]** |
| REQ-SCRAPE-3 | On any collection error (network, non-200, parse), `pbs_up` = 0 and the error is logged; the endpoint still returns 200 with whatever metrics were gathered. | `GET /metrics?target=http://localhost:1` → `pbs_up 0`, HTTP 200. **[offline-ok]** |
| REQ-SCRAPE-4 | Requests carry header `Authorization: PBSAPIToken=<username>!<tokenname>:<token>`. | Inspect request against a stub server. **[needs-pbs]** |
| REQ-SCRAPE-5 | Each PBS HTTP request is bounded by the configured timeout. | With an unresponsive target and `PBS_TIMEOUT=1s`, scrape fails within ~1s and sets `pbs_up 0`. **[offline-ok]** |
| REQ-SCRAPE-6 | When `pbs.snapshots.cache` is enabled, the exporter keeps, per resolved target, the `pbs_snapshot_*` series (`pbs_snapshot_count`, `pbs_snapshot_vm_count`, `pbs_snapshot_vm_last_timestamp`, `pbs_snapshot_vm_last_verify`) from the most recent **successful** scrape. On a subsequent **failed** scrape (`pbs_up 0`) for the same target, those cached series are re-emitted so `pbs_snapshot_*` does not disappear while PBS is offline; `pbs_snapshot_vm_last_age` is recomputed as `now - cached pbs_snapshot_vm_last_timestamp` (so it keeps growing). `pbs_up`, all non-snapshot metrics, and error logging behave exactly as when the cache is disabled. With the setting disabled (default), a failed scrape emits no cached snapshot series. A successful scrape always overwrites the cache and emits fresh values. | Scrape a healthy PBS (cache enabled) then a failing one for the same target: `pbs_up 0` but `pbs_snapshot_*` series persist and `pbs_snapshot_vm_last_age` ≈ `now - pbs_snapshot_vm_last_timestamp`. **[needs-pbs]** |
