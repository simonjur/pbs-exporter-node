import { describe, expect, it } from "vitest";
import { validateUrl } from "../url.ts";

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
