/**
 * Filesystem-driver specifics: the on-disk document, surviving a restart, and
 * the best-effort error handling that must never fail a scrape. The shared
 * get/set/clear semantics are covered by `snapshotCacheDriver.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createLogger, type Logger } from "winston";
import {
  FsSnapshotCacheDriver,
  SNAPSHOT_CACHE_FILE,
} from "../../cache/snapshotCacheFsDriver.ts";
import { SnapshotCache } from "../../cache/snapshotCache.ts";
import { testLogger } from "../pbs.fixtures.ts";
import {
  emptyMetrics,
  LAST_TIMESTAMP,
  makeCacheDirectory,
  populatedMetrics,
  sampleEntry,
  TARGET,
  valueOf,
  VM_LABELS,
} from "./cache.fixtures.ts";

/** A silent logger whose `warn` calls can be asserted on. */
function spyLogger(): { log: Logger; warn: ReturnType<typeof vi.spyOn> } {
  const log = createLogger({ silent: true });
  return { log, warn: vi.spyOn(log, "warn") };
}

describe("FsSnapshotCacheDriver", () => {
  let directory: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ directory, cleanup } = await makeCacheDirectory());
  });

  afterEach(async () => {
    await cleanup();
  });

  const cacheFile = () => path.join(directory, SNAPSHOT_CACHE_FILE);
  const driver = (target = directory, log: Logger = testLogger) =>
    new FsSnapshotCacheDriver(target, log);

  describe("the on-disk document", () => {
    it("writes the entries to snapshots-cache.json", async () => {
      await new SnapshotCache(driver()).capture(TARGET, populatedMetrics());

      const raw = await readFile(cacheFile(), "utf8");
      expect(JSON.parse(raw)).toEqual({
        version: 1,
        targets: {
          [TARGET]: {
            snapshotCount: [
              { labels: { datastore: "slow-xfs", namespace: "" }, value: 4 },
            ],
            snapshotVmCount: [{ labels: VM_LABELS, value: 2 }],
            snapshotVmLastTimestamp: [
              { labels: VM_LABELS, value: LAST_TIMESTAMP },
            ],
            snapshotVmLastVerify: [{ labels: VM_LABELS, value: 1 }],
          },
        },
      });
    });

    it("creates the cache directory on first write", async () => {
      const nested = path.join(directory, "nested", "cache");
      await driver(nested).set(TARGET, sampleEntry());

      const raw = await readFile(
        path.join(nested, SNAPSHOT_CACHE_FILE),
        "utf8",
      );
      expect(raw).toContain(TARGET);
    });

    it("leaves no temp file behind after writing", async () => {
      await driver().set(TARGET, sampleEntry());
      expect(await readdir(directory)).toEqual([SNAPSHOT_CACHE_FILE]);
    });

    it("empties the document on clear", async () => {
      const d = driver();
      await d.set(TARGET, sampleEntry());
      await d.clear();

      const raw = await readFile(cacheFile(), "utf8");
      expect(JSON.parse(raw)).toEqual({ version: 1, targets: {} });
    });
  });

  describe("reloading after a restart", () => {
    it("serves cached snapshot series to a driver started later", async () => {
      const before = new SnapshotCache(driver());
      await before.capture(TARGET, populatedMetrics());

      // A fresh driver over the same directory stands in for a restarted
      // exporter whose PBS is still offline.
      const after = new SnapshotCache(driver());
      const fresh = emptyMetrics();
      expect(await after.has(TARGET)).toBe(true);
      expect(await after.apply(TARGET, fresh, 1_781_000_000_000)).toBe(true);
      expect(await valueOf(fresh.snapshotVmLastTimestamp)).toBe(LAST_TIMESTAMP);
      expect(await valueOf(fresh.snapshotVmLastAge)).toBe(316_078);
    });

    it("merges into the reloaded document instead of dropping it", async () => {
      await driver().set(TARGET, sampleEntry());

      const restarted = driver();
      await restarted.set("https://second:8007", sampleEntry(9));

      const raw = await readFile(cacheFile(), "utf8");
      expect(Object.keys(JSON.parse(raw).targets)).toEqual([
        TARGET,
        "https://second:8007",
      ]);
    });

    it("starts empty when the cache file does not exist yet", async () => {
      const missing = path.join(directory, "does", "not", "exist");
      expect(await driver(missing).get(TARGET)).toBeUndefined();
    });
  });

  describe("best-effort error handling", () => {
    it("ignores a corrupt cache file and rewrites it on the next capture", async () => {
      await writeFile(cacheFile(), "{ not json", "utf8");
      const { log, warn } = spyLogger();

      const d = driver(directory, log);
      expect(await d.get(TARGET)).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("ignoring unreadable"),
      );

      await d.set(TARGET, sampleEntry());
      const raw = await readFile(cacheFile(), "utf8");
      expect(JSON.parse(raw).targets).toHaveProperty([TARGET]);
    });

    it("ignores a document without a targets map", async () => {
      await writeFile(cacheFile(), JSON.stringify(["nope"]), "utf8");
      const { log, warn } = spyLogger();

      expect(await driver(directory, log).get(TARGET)).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("ignoring unreadable"),
      );
    });

    it("skips entries whose shape does not match, keeping the valid ones", async () => {
      await writeFile(
        cacheFile(),
        JSON.stringify({
          version: 1,
          targets: {
            [TARGET]: { snapshotCount: "nope" },
            "https://good:8007": {
              snapshotCount: [{ labels: { datastore: "d" }, value: 7 }],
              snapshotVmCount: [],
              snapshotVmLastTimestamp: [],
              snapshotVmLastVerify: [{ labels: {}, value: "bogus" }],
            },
          },
        }),
        "utf8",
      );

      const cache = new SnapshotCache(driver());
      expect(await cache.has(TARGET)).toBe(false);

      const fresh = emptyMetrics();
      expect(await cache.apply("https://good:8007", fresh, 0)).toBe(true);
      expect(await valueOf(fresh.snapshotCount)).toBe(7);
      // The non-numeric sample was dropped rather than emitted.
      const verify = await fresh.snapshotVmLastVerify.get();
      expect(verify.values).toHaveLength(0);
    });

    it("warns instead of throwing when the file cannot be read", async () => {
      const { log, warn } = spyLogger();
      // A file where the cache *directory* should be makes the read fail with
      // ENOTDIR rather than the expected ENOENT.
      const blocked = path.join(directory, "blocked");
      await writeFile(blocked, "not a directory", "utf8");

      expect(await driver(blocked, log).get(TARGET)).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("unable to read"),
      );
    });

    it("keeps serving from memory when the file cannot be written", async () => {
      const { log, warn } = spyLogger();
      const blocked = path.join(directory, "blocked");
      await writeFile(blocked, "not a directory", "utf8");

      const d = driver(blocked, log);
      await expect(d.set(TARGET, sampleEntry())).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("unable to write"),
      );
      // The in-memory mirror still answers, so scrapes keep working.
      expect(await d.get(TARGET)).toBeDefined();
    });
  });
});
