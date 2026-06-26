# 6. PBS API calls

> Part of the [PBS Exporter specification](../SPEC.md). See the index for the
> spec-driven-development workflow and the meaning of **[offline-ok]** / **[needs-pbs]**.

All paths are relative to the resolved endpoint.

| ID | Call | Purpose |
|----|------|---------|
| REQ-API-1 | `GET /api2/json/version` | version metric |
| REQ-API-2 | `GET /api2/json/status/datastore-usage` | per-datastore usage |
| REQ-API-3 | `GET /api2/json/admin/datastore/<store>/namespace` | namespaces of a datastore |
| REQ-API-4 | `GET /api2/json/admin/datastore/<store>/snapshots?ns=<ns>` | snapshots in a namespace |
| REQ-API-5 | `GET /api2/json/nodes/localhost/status` | host metrics |
| REQ-API-6 | `GET /api2/json/nodes/localhost/subscription` | subscription metrics |

**Verify [needs-pbs]:** capture requests against a stub and confirm the exact path set above is requested.
