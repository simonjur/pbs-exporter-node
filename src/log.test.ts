import { describe, expect, it } from "vitest";
import { sanitize } from "./log.ts";

describe("sanitize", () => {
  it("strips CR and LF to prevent log injection", () => {
    expect(sanitize("a\nb\r\nc")).toBe("abc");
    expect(sanitize("https://pbs:8007/x")).toBe("https://pbs:8007/x");
  });
});
