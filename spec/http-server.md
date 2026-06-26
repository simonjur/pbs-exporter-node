# 4. HTTP server

> Part of the [PBS Exporter specification](../SPEC.md). See the index for the
> spec-driven-development workflow and the meaning of **[offline-ok]** / **[needs-pbs]**.

| ID | Requirement | Verify |
|----|-------------|--------|
| REQ-HTTP-1 | Listens on the configured address/port; `:PORT` binds all interfaces. | `curl -s http://localhost:19099/` returns 200. **[offline-ok]** |
| REQ-HTTP-2 | `GET /` returns the HTML shell for the [status UI](status-ui.md), which loads the vendored Vue/Vuetify assets and `/assets/app.js`. | Response is `text/html` and references `/assets/app.js`. **[offline-ok]** |
| REQ-HTTP-3 | `GET <metrics-path>` returns Prometheus text format with `Content-Type` from prom-client. | `curl -sI http://localhost:19099/metrics` shows `text/plain; version=0.0.4`. **[offline-ok]** |
| REQ-HTTP-4 | Unknown paths return HTTP 404. | `curl -s -o /dev/null -w '%{http_code}' http://localhost:19099/nope` → `404`. **[offline-ok]** |
| REQ-HTTP-5 | Target resolution: if `endpoint` is configured it is always used; otherwise the `?target=` query param is used; otherwise default `http://localhost:8007`. | With no endpoint set, `GET /metrics?target=http://localhost:1` attempts that target (debug log shows it). **[offline-ok]** |
