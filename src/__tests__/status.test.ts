import { afterEach, describe, expect, it } from "vitest";
import {
  getStatuses,
  getSummary,
  recordScrape,
  resetStatuses,
  seedTarget,
} from "../status.ts";

afterEach(() => {
  resetStatuses();
});

describe("seedTarget", () => {
  it("registers a target in a pending state", () => {
    seedTarget("https://pbs:8007");
    const [s] = getStatuses();
    expect(s).toMatchObject({
      target: "https://pbs:8007",
      up: null,
      lastScrapeMs: null,
      error: null,
    });
  });

  it("does not overwrite an existing target", () => {
    recordScrape({ target: "https://pbs:8007", up: true, nowMs: 1000 });
    seedTarget("https://pbs:8007");
    expect(getStatuses()[0]?.up).toBe(true);
  });
});

describe("recordScrape", () => {
  it("stores a successful scrape with version and timestamp", () => {
    recordScrape({
      target: "https://pbs:8007",
      up: true,
      version: "3.2.7",
      release: "3.2.7-1",
      nowMs: 1_719_000_000_000,
    });
    expect(getStatuses()[0]).toEqual({
      target: "https://pbs:8007",
      up: true,
      version: "3.2.7",
      release: "3.2.7-1",
      lastScrapeMs: 1_719_000_000_000,
      error: null,
    });
  });

  it("stores a failed scrape with its error message", () => {
    recordScrape({
      target: "https://pbs:8007",
      up: false,
      error: "Status code 401",
      nowMs: 1000,
    });
    expect(getStatuses()[0]).toMatchObject({
      up: false,
      error: "Status code 401",
    });
  });

  it("replaces the previous result for the same target", () => {
    recordScrape({ target: "https://pbs:8007", up: true, nowMs: 1 });
    recordScrape({
      target: "https://pbs:8007",
      up: false,
      error: "down",
      nowMs: 2,
    });
    expect(getStatuses()).toHaveLength(1);
    expect(getStatuses()[0]).toMatchObject({ up: false, lastScrapeMs: 2 });
  });
});

describe("getStatuses", () => {
  it("returns targets sorted by endpoint", () => {
    recordScrape({ target: "https://b:8007", up: true, nowMs: 1 });
    recordScrape({ target: "https://a:8007", up: true, nowMs: 1 });
    expect(getStatuses().map((s) => s.target)).toEqual([
      "https://a:8007",
      "https://b:8007",
    ]);
  });
});

describe("getSummary", () => {
  it("counts up, down and pending targets", () => {
    seedTarget("https://pending:8007");
    recordScrape({ target: "https://up:8007", up: true, nowMs: 1 });
    recordScrape({
      target: "https://down:8007",
      up: false,
      error: "x",
      nowMs: 1,
    });
    expect(getSummary()).toEqual({ total: 3, up: 1, down: 1, pending: 1 });
  });

  it("is all-zero when empty", () => {
    expect(getSummary()).toEqual({ total: 0, up: 0, down: 0, pending: 0 });
  });
});
