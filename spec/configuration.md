# 3. Configuration

> Part of the [PBS Exporter specification](../SPEC.md). See the index for the
> spec-driven-development workflow and the meaning of **[offline-ok]** / **[needs-pbs]**.

Precedence (lowest → highest): built-in default → CLI flag → environment variable.

| ID | Requirement | Verify |
|----|-------------|--------|
| REQ-CFG-1 | Flags are parsed with [commander](https://github.com/tj/commander.js) (the global `program` singleton, in the [`src/run.ts`](../src/run.ts) entrypoint). Supports `--pbs.endpoint`, `--pbs.username`, `--pbs.api.token`, `--pbs.api.token.name`, `--pbs.timeout`, `--pbs.insecure`, `--pbs.metrics-path`, `--pbs.listen-address`, `--pbs.loglevel`, `--pbs.logformat`, `--version`, in both `--key=value` and `--key value` forms. Unknown flags are rejected with a usage error (commander default). | Start with `--pbs.listen-address=:19099` and `--pbs.metrics-path /m`; confirm metrics served at `/m`. **[offline-ok]** |
| REQ-CFG-1a | Commander auto-generates `--help` listing every option with its default. | `node src/run.ts --help` lists all `--pbs.*` options. **[offline-ok]** |
| REQ-CFG-2 | Environment variables `PBS_ENDPOINT`, `PBS_USERNAME`, `PBS_API_TOKEN`, `PBS_API_TOKEN_NAME`, `PBS_TIMEOUT`, `PBS_INSECURE`, `PBS_METRICS_PATH`, `PBS_LISTEN_ADDRESS`, `PBS_LOGLEVEL`, `PBS_LOGFORMAT` override flags/defaults. | Set `PBS_METRICS_PATH=/x` while passing `--pbs.metrics-path=/y`; metrics MUST be at `/x`. **[offline-ok]** |
| REQ-CFG-3 | Defaults: username `root@pam`, api token name `pbs-exporter`, timeout `5s`, insecure `false`, metrics path `/metrics`, listen address `:10019`, loglevel `info`, logformat `text`. | Start with no config; logs report listen `:10019`, path `/metrics`. **[offline-ok]** |
| REQ-CFG-4 | `PBS_USERNAME_FILE`, `PBS_API_TOKEN_FILE`, `PBS_API_TOKEN_NAME_FILE` read the **first line** of the named file (used only when the non-`_FILE` var is unset). | Point `PBS_API_TOKEN_FILE` at a 2-line file; with debug loglevel the logged token equals line 1 only. **[offline-ok]** |
| REQ-CFG-5 | `--version` prints `PBS Exporter Version: <v>, Commit: <c>, Build Time: <t>` and exits 0 without starting the server. | `node src/run.ts --version`. **[offline-ok]** |
| REQ-CFG-6 | Invalid `pbs.insecure` (non-boolean) or `pbs.timeout` (non-duration) causes a fatal error log and non-zero exit. | `PBS_INSECURE=maybe node src/run.ts` exits non-zero with an `ERROR:` line. **[offline-ok]** |
| REQ-CFG-7 | Timeout accepts duration strings parsed by [`parse-duration`](https://github.com/jkroso/parse-duration): single or compound units (`5s`, `500ms`, `1m30s`, `1h`, `1h 20m`); a unit-less number is interpreted as milliseconds (`10` → 10ms). | `PBS_TIMEOUT=1m30s` starts successfully. **[offline-ok]** |
| REQ-CFG-8 | `logformat` selects the winston log output: `text` (default) emits human-readable `LEVEL: message` lines; `json` emits a single-line JSON object per log entry (`{"level":...,"message":...,"timestamp":...}`) suitable for ELK/log aggregators. Any other value causes a fatal error log and non-zero exit. | `PBS_LOGFORMAT=json node src/run.ts` emits JSON startup lines; `PBS_LOGFORMAT=bogus` exits non-zero with an `ERROR:` line. **[offline-ok]** |
