/**
 * The typed configuration schema for the PBS exporter, expressed with
 * [zod](https://zod.dev).
 *
 * `loadConfig` in [`config.ts`](./config.ts) assembles a single record of raw
 * string inputs (applying the default → flag → env precedence) and hands it to
 * {@link configSchema}, which validates/coerces every field and produces the
 * fully-typed {@link Config}. Keeping the schema here — separate from the
 * option/env plumbing — means the shape of the configuration and its validation
 * rules live in one place, and every parse failure yields a clear, per-field
 * message (see zod's `prettifyError`).
 */

import { z } from "zod";
import parse from "parse-duration";
import { validateUrl } from "./url.ts";

/** Winston npm log levels (see `winston.config.npm.levels`). */
const LOG_LEVELS = [
  "error",
  "warn",
  "info",
  "http",
  "verbose",
  "debug",
  "silly",
] as const;

/** A Go-style boolean string (`1`/`t`/`true` / `0`/`f`/`false`) → boolean. */
const booleanFromString = z.string().transform((value, context) => {
  switch (value.toLowerCase()) {
    case "1":
    case "t":
    case "true": {
      return true;
    }
    case "0":
    case "f":
    case "false": {
      return false;
    }
    default: {
      context.addIssue({
        code: "custom",
        message: `invalid boolean: ${value}`,
      });
      return z.NEVER;
    }
  }
});

/** A `parse-duration` string (`5s`, `1m30s`, `250ms`, unit-less ms) → number of ms. */
const durationMs = z.string().transform((value, context) => {
  const ms = parse(value);
  if (ms === null) {
    context.addIssue({ code: "custom", message: `invalid duration: ${value}` });
    return z.NEVER;
  }
  return ms;
});

/** An empty string (dynamic `?target=` mode) or a validated http(s) endpoint. */
const endpoint = z.string().superRefine((value, context) => {
  if (value === "") {
    return;
  }
  try {
    validateUrl(value);
  } catch (error) {
    context.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/** One of the winston npm log levels, else a clear error listing the valid set. */
const logLevel = z.string().transform((value, context) => {
  if ((LOG_LEVELS as readonly string[]).includes(value)) {
    return value as (typeof LOG_LEVELS)[number];
  }
  context.addIssue({
    code: "custom",
    message: `invalid log level: ${value} (expected one of ${LOG_LEVELS.join(", ")})`,
  });
  return z.NEVER;
});

/** `text` (human-readable) or `json` (one object per line). */
const logFormat = z.string().transform((value, context): "text" | "json" => {
  if (value === "text" || value === "json") {
    return value;
  }
  context.addIssue({ code: "custom", message: `invalid log format: ${value}` });
  return z.NEVER;
});

/**
 * The full exporter configuration schema. Input is a record of raw strings
 * (plus the boolean `showVersion`); output is the coerced, fully-typed
 * {@link Config}.
 */
export const configSchema = z.object({
  endpoint,
  username: z.string(),
  apiToken: z.string(),
  apiTokenName: z.string(),
  timeout: durationMs,
  insecure: booleanFromString,
  cacheSnapshots: booleanFromString,
  metricsPath: z.string(),
  listenAddress: z.string(),
  loglevel: logLevel,
  logFormat,
  showVersion: z.boolean(),
});

/** The fully-typed, validated exporter configuration. */
export type Config = z.infer<typeof configSchema>;
