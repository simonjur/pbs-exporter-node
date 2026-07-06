import { describe, expect, it } from "vitest";
import { type Config, configSchema } from "../configSchema.ts";

/**
 * A complete, valid raw input as `loadConfig` assembles it (all strings, plus
 * the boolean `showVersion`), with per-test overrides.
 */
function raw(overrides: Record<string, unknown> = {}) {
  return {
    endpoint: "",
    username: "root@pam",
    apiToken: "",
    apiTokenName: "pbs-exporter",
    timeout: "5s",
    insecure: "false",
    cacheSnapshots: "false",
    metricsPath: "/metrics",
    listenAddress: ":10019",
    loglevel: "info",
    logFormat: "text",
    showVersion: false,
    ...overrides,
  };
}

/** Parse via the schema, throwing a joined message on failure (for `toThrow`). */
function parse(overrides: Record<string, unknown> = {}): Config {
  const result = configSchema.safeParse(raw(overrides));
  if (!result.success) {
    throw new Error(
      result.error.issues.map((issue) => issue.message).join("; "),
    );
  }
  return result.data;
}

describe("configSchema", () => {
  it("coerces a complete valid input into a typed config", () => {
    expect(parse()).toEqual<Config>({
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

  it("parses boolean strings", () => {
    expect(parse({ insecure: "true" }).insecure).toBe(true);
    expect(parse({ insecure: "1" }).insecure).toBe(true);
    expect(parse({ insecure: "false" }).insecure).toBe(false);
    expect(parse({ cacheSnapshots: "true" }).cacheSnapshots).toBe(true);
    expect(parse({ cacheSnapshots: "0" }).cacheSnapshots).toBe(false);
  });

  it("rejects a non-boolean value", () => {
    expect(() => parse({ insecure: "maybe" })).toThrow(/invalid boolean/);
    expect(() => parse({ cacheSnapshots: "maybe" })).toThrow(/invalid boolean/);
  });

  it("parses durations into milliseconds", () => {
    expect(parse({ timeout: "1m30s" }).timeout).toBe(90_000);
    expect(parse({ timeout: "250ms" }).timeout).toBe(250);
  });

  it("rejects an invalid duration", () => {
    expect(() => parse({ timeout: "nonsense" })).toThrow(/invalid duration/);
  });

  it("accepts the text and json log formats", () => {
    expect(parse({ logFormat: "text" }).logFormat).toBe("text");
    expect(parse({ logFormat: "json" }).logFormat).toBe("json");
  });

  it("rejects an invalid log format", () => {
    expect(() => parse({ logFormat: "xml" })).toThrow(/invalid log format/);
  });

  it("accepts every winston npm log level", () => {
    for (const level of [
      "error",
      "warn",
      "info",
      "http",
      "verbose",
      "debug",
      "silly",
    ]) {
      expect(parse({ loglevel: level }).loglevel).toBe(level);
    }
  });

  it("rejects an invalid log level", () => {
    expect(() => parse({ loglevel: "trace" })).toThrow(/invalid log level/);
  });

  it("accepts an empty endpoint (dynamic target mode)", () => {
    expect(parse({ endpoint: "" }).endpoint).toBe("");
  });

  it("accepts a valid http(s) endpoint", () => {
    expect(parse({ endpoint: "https://pbs:8007" }).endpoint).toBe(
      "https://pbs:8007",
    );
  });

  it("rejects a disallowed endpoint scheme (SSRF guard)", () => {
    expect(() => parse({ endpoint: "file:///etc/passwd" })).toThrow(
      /disallowed target URL scheme/,
    );
  });

  it("rejects an unparseable endpoint", () => {
    expect(() => parse({ endpoint: "not-a-url" })).toThrow(
      /invalid target URL/,
    );
  });
});
