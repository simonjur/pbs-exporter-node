# 3. Configuration

> Part of the [PBS Exporter specification](../SPEC.md). See the index for the
> spec-driven-development workflow and the meaning of **[offline-ok]** / **[needs-pbs]**.

**Precedence (lowest → highest): built-in default → CLI flag → environment variable.**
For any given setting the value is resolved in that order, and the highest source
that is set wins:

1. the built-in **default** is used if nothing else is set;
2. a **`--pbs.*` CLI flag**, when passed, overrides the default;
3. the matching **`PBS_*` environment variable**, when set (to a non-empty value),
   overrides *both* the flag and the default.

Example: with `PBS_LOGLEVEL=info` in the environment and `--pbs.loglevel=debug` on
the command line, the effective log level is **`info`** (the env var wins). An empty
environment variable (`PBS_LOGLEVEL=`) counts as unset and falls back to the flag.

The resolved values are validated and coerced by a single [zod](https://zod.dev)
schema ([`src/configSchema.ts`](../src/configSchema.ts)); `loadConfig`
([`src/config.ts`](../src/config.ts)) returns the fully-typed `Config`, and any
invalid field produces one fatal error listing every offending field.

| ID | Requirement | Verify |
|----|-------------|--------|
| REQ-CFG-1 | Flags are parsed with [commander](https://github.com/tj/commander.js) (the global `program` singleton, in the [`src/run.ts`](../src/run.ts) entrypoint). Supports `--pbs.endpoint`, `--pbs.username`, `--pbs.api.token`, `--pbs.api.token.name`, `--pbs.timeout`, `--pbs.insecure`, `--pbs.snapshots.cache`, `--pbs.metrics-path`, `--pbs.listen-address`, `--pbs.loglevel`, `--pbs.logformat`, `--version`, in both `--key=value` and `--key value` forms. Unknown flags are rejected with a usage error (commander default). | Start with `--pbs.listen-address=:19099` and `--pbs.metrics-path /m`; confirm metrics served at `/m`. **[offline-ok]** |
| REQ-CFG-1a | Commander auto-generates `--help` listing every option with its default. | `node src/run.ts --help` lists all `--pbs.*` options. **[offline-ok]** |
| REQ-CFG-2 | Environment variables `PBS_ENDPOINT`, `PBS_USERNAME`, `PBS_API_TOKEN`, `PBS_API_TOKEN_NAME`, `PBS_TIMEOUT`, `PBS_INSECURE`, `PBS_SNAPSHOTS_CACHE`, `PBS_METRICS_PATH`, `PBS_LISTEN_ADDRESS`, `PBS_LOGLEVEL`, `PBS_LOGFORMAT` override flags/defaults. | Set `PBS_METRICS_PATH=/x` while passing `--pbs.metrics-path=/y`; metrics MUST be at `/x`. **[offline-ok]** |
| REQ-CFG-3 | Defaults: username `root@pam`, api token name `pbs-exporter`, timeout `5s`, insecure `false`, snapshots cache `false`, metrics path `/metrics`, listen address `:10019`, loglevel `info`, logformat `text`. | Start with no config; logs report listen `:10019`, path `/metrics`. **[offline-ok]** |
| REQ-CFG-5 | `--version` prints `PBS Exporter Version: <v>, Commit: <c>, Build Time: <t>` and exits 0 without starting the server. | `node src/run.ts --version`. **[offline-ok]** |
| REQ-CFG-6 | Invalid values — `pbs.insecure`/`pbs.snapshots.cache` (non-boolean), `pbs.timeout` (non-duration), `pbs.endpoint` (bad URL/scheme), `pbs.loglevel` (not a winston npm level), `pbs.logformat` (not `text`/`json`) — cause one fatal `ERROR:` log naming every offending field and a non-zero exit. Validation is performed by the zod schema in [`src/configSchema.ts`](../src/configSchema.ts). | `PBS_INSECURE=maybe PBS_TIMEOUT=nope node src/run.ts` exits non-zero with a single `ERROR:` line mentioning both `insecure` and `timeout`. **[offline-ok]** |
| REQ-CFG-7 | Timeout accepts duration strings parsed by [`parse-duration`](https://github.com/jkroso/parse-duration): single or compound units (`5s`, `500ms`, `1m30s`, `1h`, `1h 20m`); a unit-less number is interpreted as milliseconds (`10` → 10ms). | `PBS_TIMEOUT=1m30s` starts successfully. **[offline-ok]** |
| REQ-CFG-8 | `logformat` selects the winston log output: `text` (default) emits human-readable `LEVEL: message` lines; `json` emits a single-line JSON object per log entry (`{"level":...,"message":...,"timestamp":...}`) suitable for ELK/log aggregators. Any other value causes a fatal error log and non-zero exit. | `PBS_LOGFORMAT=json node src/run.ts` emits JSON startup lines; `PBS_LOGFORMAT=bogus` exits non-zero with an `ERROR:` line. **[offline-ok]** |
| REQ-CFG-9 | `pbs.snapshots.cache` is a boolean (same string parsing as `pbs.insecure`: `1`/`t`/`true` / `0`/`f`/`false`) that enables serving stale `pbs_snapshot_*` metrics from an in-memory cache when a scrape fails; invalid (non-boolean) values cause a fatal error log and non-zero exit. See `REQ-SCRAPE-6` for the behaviour. | `PBS_SNAPSHOTS_CACHE=true node src/run.ts` starts; `PBS_SNAPSHOTS_CACHE=maybe` exits non-zero with an `ERROR:` line. **[offline-ok]** |
| REQ-CFG-10 | `loglevel` must be one of the winston npm levels: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`; any other value is rejected (see REQ-CFG-6) with an error naming the accepted set. | `PBS_LOGLEVEL=trace node src/run.ts` exits non-zero with an `ERROR:` line listing the valid levels; `PBS_LOGLEVEL=debug` starts. **[offline-ok]** |
