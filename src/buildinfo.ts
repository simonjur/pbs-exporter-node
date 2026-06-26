/**
 * Build metadata. These are normally injected at build time and may be
 * overridden via environment variables at runtime.
 */

export const Version = process.env.PBS_BUILD_VERSION ?? "v0.0.0-dev.0";
export const Commit = process.env.PBS_BUILD_COMMIT ?? "none";
export const BuildTime = process.env.PBS_BUILD_TIME ?? "unknown";
