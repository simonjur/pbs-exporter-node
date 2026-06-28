import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type CliOptions,
  type Config,
  loadConfig,
  parseBool,
  readSecretFile,
  validateUrl,
} from "../config.ts";

/**
 * Build a parsed-options object as commander would produce it (defaults applied),
 * with per-test overrides. Mirrors the `.option()` defaults declared in run.ts.
 */
function opts(overrides: Partial<CliOptions> = {}): CliOptions {
  return {
    "pbs.endpoint": "",
    "pbs.username": "root@pam",
    "pbs.api.token": "",
    "pbs.api.token.name": "pbs-exporter",
    "pbs.timeout": "5s",
    "pbs.insecure": "false",
    "pbs.metricsPath": "/metrics",
    "pbs.listenAddress": ":10019",
    "pbs.loglevel": "info",
    "pbs.logformat": "text",
    version: false,
    ...overrides,
  };
}

// Temp files created during tests, cleaned up afterwards.
const tmpFiles: string[] = [];
function secretFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "pbs-exporter-test-"));
  const path = join(dir, "secret");
  writeFileSync(path, contents);
  tmpFiles.push(dir);
  return path;
}

afterEach(() => {
  while (tmpFiles.length)
    rmSync(tmpFiles.pop()!, { recursive: true, force: true });
});

describe("parseBool", () => {
  it.each([
    ["true", true],
    ["TRUE", true],
    ["t", true],
    ["1", true],
    ["false", false],
    ["F", false],
    ["0", false],
  ])("parses %j -> %s", (input, expected) => {
    expect(parseBool(input)).toBe(expected);
  });

  it.each(["", "yes", "no", "2"])("throws on invalid boolean %j", (input) => {
    expect(() => parseBool(input)).toThrow(/invalid boolean/);
  });
});

describe("readSecretFile", () => {
  it("returns only the first line", () => {
    expect(readSecretFile(secretFile("topsecret\nsecondline\n"))).toBe(
      "topsecret",
    );
  });

  it("handles a file without a trailing newline", () => {
    expect(readSecretFile(secretFile("just-one-line"))).toBe("just-one-line");
  });

  it("handles CRLF line endings", () => {
    expect(readSecretFile(secretFile("windows\r\nline"))).toBe("windows");
  });
});

describe("loadConfig", () => {
  const noEnv: NodeJS.ProcessEnv = {};

  it("applies built-in defaults with no overrides or env", () => {
    const c = loadConfig(opts(), noEnv);
    expect(c).toEqual<Config>({
      endpoint: "",
      username: "root@pam",
      apiToken: "",
      apiTokenName: "pbs-exporter",
      timeout: 5000,
      insecure: "false",
      metricsPath: "/metrics",
      listenAddress: ":10019",
      loglevel: "info",
      logFormat: "text",
      showVersion: false,
    });
  });

  it("maps parsed CLI options onto the config", () => {
    const c = loadConfig(
      opts({ "pbs.endpoint": "https://pbs:8007", "pbs.metricsPath": "/m" }),
      noEnv,
    );
    expect(c.endpoint).toBe("https://pbs:8007");
    expect(c.metricsPath).toBe("/m");
  });

  it("maps dotted and hyphenated option keys", () => {
    const c = loadConfig(
      opts({ "pbs.api.token.name": "mytoken", "pbs.listenAddress": ":9999" }),
      noEnv,
    );
    expect(c.apiTokenName).toBe("mytoken");
    expect(c.listenAddress).toBe(":9999");
  });

  it("sets showVersion when the --version option is set", () => {
    expect(loadConfig(opts({ version: true }), noEnv).showVersion).toBe(true);
    expect(loadConfig(opts(), noEnv).showVersion).toBe(false);
  });

  it("lets environment variables override CLI options", () => {
    const c = loadConfig(
      opts({ "pbs.metricsPath": "/flag", "pbs.endpoint": "http://flag" }),
      {
        PBS_METRICS_PATH: "/env",
        PBS_ENDPOINT: "http://env",
      },
    );
    expect(c.metricsPath).toBe("/env");
    expect(c.endpoint).toBe("http://env");
  });

  it("reads secrets from *_FILE env vars when the direct var is unset", () => {
    const c = loadConfig(opts(), {
      PBS_API_TOKEN_FILE: secretFile("file-token\nignored"),
      PBS_USERNAME_FILE: secretFile("file-user"),
      PBS_API_TOKEN_NAME_FILE: secretFile("file-token-name"),
    });
    expect(c.apiToken).toBe("file-token");
    expect(c.username).toBe("file-user");
    expect(c.apiTokenName).toBe("file-token-name");
  });

  it("prefers the direct env var over its *_FILE counterpart", () => {
    const c = loadConfig(opts(), {
      PBS_API_TOKEN: "direct-token",
      PBS_API_TOKEN_FILE: secretFile("file-token"),
    });
    expect(c.apiToken).toBe("direct-token");
  });

  it("parses the timeout duration into milliseconds", () => {
    expect(loadConfig(opts({ "pbs.timeout": "1m30s" }), noEnv).timeout).toBe(
      90000,
    );
    expect(loadConfig(opts(), { PBS_TIMEOUT: "250ms" }).timeout).toBe(250);
  });

  it("throws on an invalid timeout duration", () => {
    expect(() => loadConfig(opts(), { PBS_TIMEOUT: "nonsense" })).toThrow(
      /invalid duration/,
    );
  });

  it("reads the log format from the option and env", () => {
    expect(loadConfig(opts({ "pbs.logformat": "json" }), noEnv).logFormat).toBe(
      "json",
    );
    expect(loadConfig(opts(), { PBS_LOGFORMAT: "json" }).logFormat).toBe(
      "json",
    );
    // Env overrides the option.
    expect(
      loadConfig(opts({ "pbs.logformat": "json" }), { PBS_LOGFORMAT: "text" })
        .logFormat,
    ).toBe("text");
  });

  it("throws on an invalid log format", () => {
    expect(() => loadConfig(opts(), { PBS_LOGFORMAT: "xml" })).toThrow(
      /invalid log format/,
    );
  });

  it("validates a configured endpoint scheme (SSRF guard)", () => {
    expect(
      loadConfig(opts(), { PBS_ENDPOINT: "https://pbs:8007" }).endpoint,
    ).toBe("https://pbs:8007");
    expect(() =>
      loadConfig(opts(), { PBS_ENDPOINT: "file:///etc/passwd" }),
    ).toThrow(/disallowed target URL scheme/);
    expect(() => loadConfig(opts(), { PBS_ENDPOINT: "not-a-url" })).toThrow(
      /invalid target URL/,
    );
  });

  it("leaves an empty endpoint unvalidated (dynamic target mode)", () => {
    expect(loadConfig(opts(), noEnv).endpoint).toBe("");
  });
});

describe("validateUrl", () => {
  it.each([
    "http://localhost:8007",
    "https://192.168.1.164:8007",
    "https://pbs.example.com",
  ])("accepts http(s) URL %j and returns a URL", (url) => {
    const result = validateUrl(url);
    expect(result).toBeInstanceOf(URL);
    expect(result.href).toBe(new URL(url).href);
  });

  it.each([
    "file:///etc/passwd",
    "gopher://x",
    "ftp://h/f",
    "data:text/plain,x",
  ])("rejects disallowed scheme %j", (url) => {
    expect(() => validateUrl(url)).toThrow(/disallowed target URL scheme/);
  });

  it.each(["", "not-a-url", "//no-scheme"])(
    "rejects unparseable URL %j",
    (url) => {
      expect(() => validateUrl(url)).toThrow(/invalid target URL/);
    },
  );
});
