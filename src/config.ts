/**
 * Configuration building for the PBS exporter.
 *
 * Resolution precedence (lowest → highest): built-in default → CLI flag →
 * environment variable. In other words the `PBS_*` environment variable, when
 * set, always wins over the corresponding `--pbs.*` flag, which in turn wins
 * over the built-in default. (A flag always carries at least its default, so
 * "flag" here means "the flag's value or its default".)
 *
 * CLI flags are parsed with commander in the entrypoint ([`run.ts`](./run.ts));
 * this module stays pure — it maps the already-parsed options plus the
 * environment into a single record of raw strings, then validates and coerces
 * it through the zod {@link configSchema} (see [`config-schema.ts`](./configSchema.ts)),
 * returning a fully-typed {@link Config}. Validation failures throw a single
 * error listing every offending field.
 */

import type { ZodError } from "zod";
import { type Config, configSchema } from "./configSchema.ts";

export type { Config } from "./configSchema.ts";

/**
 * Parsed CLI options as produced by commander's `program.options()` in `run.ts`.
 * Keys match the commander option names: the segment after the last hyphen group
 * is camel-cased (`--pbs.metrics-path` → `pbs.metricsPath`), dots are preserved.
 */
export type CliOptions = {
  "pbs.endpoint": string;
  "pbs.username": string;
  "pbs.api.token": string;
  "pbs.api.token.name": string;
  "pbs.timeout": string;
  "pbs.insecure": string;
  "pbs.snapshots.cache": string;
  "pbs.metricsPath": string;
  "pbs.listenAddress": string;
  "pbs.loglevel": string;
  "pbs.logformat": string;
  version?: boolean;
};

/**
 * Build the exporter configuration from parsed CLI options and the environment.
 *
 * Pure: commander parsing happens in `run.ts`; this only resolves the
 * precedence (env over flag over default) and validates via the zod schema.
 *
 * @param options Parsed CLI options (from `program.options()` in `run.ts`).
 * @param environment  Environment map (defaults to `process.env`).
 * @throws if any value fails validation (invalid URL/duration/boolean/level/format).
 */
export function loadConfig(
  options: CliOptions,
  environment: NodeJS.ProcessEnv = process.env,
): Config {
  // Resolve each field to its raw value with env-over-flag precedence. `||` (not
  // `??`) so an empty env var falls back to the flag/default rather than winning.
  const raw = {
    endpoint: environment.PBS_ENDPOINT || options["pbs.endpoint"],
    username: environment.PBS_USERNAME || options["pbs.username"],
    apiToken: environment.PBS_API_TOKEN || options["pbs.api.token"],
    apiTokenName:
      environment.PBS_API_TOKEN_NAME || options["pbs.api.token.name"],
    timeout: environment.PBS_TIMEOUT || options["pbs.timeout"],
    insecure: environment.PBS_INSECURE || options["pbs.insecure"],
    cacheSnapshots:
      environment.PBS_SNAPSHOTS_CACHE || options["pbs.snapshots.cache"],
    metricsPath: environment.PBS_METRICS_PATH || options["pbs.metricsPath"],
    listenAddress:
      environment.PBS_LISTEN_ADDRESS || options["pbs.listenAddress"],
    loglevel: environment.PBS_LOGLEVEL || options["pbs.loglevel"],
    logFormat: environment.PBS_LOGFORMAT || options["pbs.logformat"],
    showVersion: options.version === true,
  };

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`invalid configuration: ${formatIssues(result.error)}`);
  }
  return result.data;
}

/**
 * Render zod issues as a single line (`field: message; field: message`). The
 * logger strips CR/LF for injection safety, so a one-line message stays readable
 * once logged — unlike zod's multi-line `prettifyError` output.
 */
function formatIssues(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const field = issue.path.join(".");
      return field ? `${field}: ${issue.message}` : issue.message;
    })
    .join("; ");
}
