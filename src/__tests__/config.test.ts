import { describe, expect, it } from "vitest";
import { type CliOptions, type Config, loadConfig } from "../config.ts";

/**
 * Build a parsed-options object as commander would produce it (defaults applied),
 * with per-test overrides. Mirrors the `.option()` defaults declared in run.ts.
 */
function options(overrides: Partial<CliOptions> = {}): CliOptions {
  return {
    "pbs.endpoint": "",
    "pbs.username": "root@pam",
    "pbs.api.token": "",
    "pbs.api.token.name": "pbs-exporter",
    "pbs.timeout": "5s",
    "pbs.insecure": "false",
    "pbs.snapshots.cache": "false",
    "pbs.metricsPath": "/metrics",
    "pbs.listenAddress": ":10019",
    "pbs.loglevel": "info",
    "pbs.logformat": "text",
    version: false,
    ...overrides,
  };
}

// `loadConfig` is the option/env plumbing: it resolves the precedence into raw
// values and hands them to the zod schema. Field-level validation and coercion
// are covered by `configSchema.test.ts`; these tests focus on mapping,
// precedence, and error aggregation.
describe("loadConfig", () => {
  const noEnvironment: NodeJS.ProcessEnv = {};

  it("applies built-in defaults with no overrides or env", () => {
    const c = loadConfig(options(), noEnvironment);
    expect(c).toEqual<Config>({
      endpoint: "",
      username: "root@pam",
      apiToken: "",
      apiTokenName: "pbs-exporter",
      timeout: 5000,
      insecure: false,
      cacheSnapshots: false,
      metricsPath: "/metrics",
      listenAddress: ":10019",
      loglevel: "info",
      logFormat: "text",
      showVersion: false,
    });
  });

  it("maps parsed CLI options onto the config", () => {
    const c = loadConfig(
      options({ "pbs.endpoint": "https://pbs:8007", "pbs.metricsPath": "/m" }),
      noEnvironment,
    );
    expect(c.endpoint).toBe("https://pbs:8007");
    expect(c.metricsPath).toBe("/m");
  });

  it("maps dotted and hyphenated option keys", () => {
    const c = loadConfig(
      options({
        "pbs.api.token.name": "mytoken",
        "pbs.listenAddress": ":9999",
      }),
      noEnvironment,
    );
    expect(c.apiTokenName).toBe("mytoken");
    expect(c.listenAddress).toBe(":9999");
  });

  it("sets showVersion when the --version option is set", () => {
    expect(
      loadConfig(options({ version: true }), noEnvironment).showVersion,
    ).toBe(true);
    expect(loadConfig(options(), noEnvironment).showVersion).toBe(false);
  });

  it("resolves precedence default < flag < env for the same key", () => {
    // default only
    expect(loadConfig(options(), noEnvironment).metricsPath).toBe("/metrics");
    // flag overrides default
    expect(
      loadConfig(options({ "pbs.metricsPath": "/flag" }), noEnvironment)
        .metricsPath,
    ).toBe("/flag");
    // env overrides flag
    expect(
      loadConfig(options({ "pbs.metricsPath": "/flag" }), {
        PBS_METRICS_PATH: "/env",
      }).metricsPath,
    ).toBe("/env");
  });

  it("treats an empty env var as unset (falls back to the flag)", () => {
    const c = loadConfig(options({ "pbs.metricsPath": "/flag" }), {
      PBS_METRICS_PATH: "",
    });
    expect(c.metricsPath).toBe("/flag");
  });

  it("reads secrets straight from their env vars", () => {
    const c = loadConfig(options(), {
      PBS_API_TOKEN: "the-token",
      PBS_USERNAME: "svc@pbs",
      PBS_API_TOKEN_NAME: "the-name",
    });
    expect(c.apiToken).toBe("the-token");
    expect(c.username).toBe("svc@pbs");
    expect(c.apiTokenName).toBe("the-name");
  });

  it("reports every offending field in one error", () => {
    expect(() =>
      loadConfig(options({ "pbs.insecure": "maybe" }), {
        PBS_TIMEOUT: "nope",
        PBS_LOGFORMAT: "xml",
      }),
    ).toThrow(/invalid configuration/);
  });
});
