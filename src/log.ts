/**
 * Logging via winston.
 *
 * Exposes a winston logger as `log` (with `.info`/`.error`/`.debug`), plus the
 * log-level/format accessors used at startup. The `text` format (default) emits
 * `LEVEL: message` lines; the `json` format emits one JSON object per entry for
 * log aggregators (ELK etc.). Output goes to stdout — except `error`, which
 * goes to stderr. `sanitize` strips CR/LF from user-controlled values before
 * they are logged, preventing log injection.
 */

import winston from "winston";
import type { LogFormat } from "./config.ts";

/** Strip CR/LF to prevent log injection from user-controlled values. */
export function sanitize(value: string): string {
  return value.replaceAll("\n", "").replaceAll("\r", "");
}

// Human-readable: "LEVEL: message".
const textFormat = winston.format.printf(
  (info) => `${info.level.toUpperCase()}: ${String(info.message)}`,
);

// Single-line JSON with a timestamp, e.g. for ELK / log aggregators.
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
);

export const log = winston.createLogger({
  level: "info",
  levels: winston.config.npm.levels,
  format: textFormat,
  transports: [new winston.transports.Console({ stderrLevels: ["error"] })],
});

/** Set the active log level (called once at startup). */
export function setLogLevel(level: string): void {
  log.level = level;
}

/** The currently active log level. */
export function getLogLevel(): string {
  return log.level;
}

/** Select the output format (called once at startup). */
export function setLogFormat(format: LogFormat): void {
  log.format = format === "json" ? jsonFormat : textFormat;
}
