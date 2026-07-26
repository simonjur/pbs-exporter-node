import { describe, expect, it } from "vitest";
import type { Config } from "../../config.ts";
import type {
  SnapshotCacheDriver,
  SnapshotCacheEntry,
} from "../../cache/snapshotCacheDriver.ts";
import { MemorySnapshotCacheDriver } from "../../cache/snapshotCacheMemoryDriver.ts";
import {
  createSnapshotCache,
  SnapshotCache,
} from "../../cache/snapshotCache.ts";
import { testLogger } from "../pbs.fixtures.ts";
import {
  emptyMetrics,
  LAST_TIMESTAMP,
  OTHER_TARGET,
  populatedMetrics,
  TARGET,
  valueOf,
  VM_LABELS,
} from "./cache.fixtures.ts";

/** The class under test, over the (separately tested) in-memory driver. */
function cache(): SnapshotCache {
  return new SnapshotCache(new MemorySnapshotCacheDriver());
}

describe("SnapshotCache.capture", () => {
  it("hands the four cacheable series to the driver, keyed by target", async () => {
    const stored: Array<[string, SnapshotCacheEntry]> = [];
    const driver: SnapshotCacheDriver = {
      name: "memory",
      get: () => Promise.resolve(undefined),
      set: (target, entry) => {
        stored.push([target, entry]);
        return Promise.resolve();
      },
      clear: () => Promise.resolve(),
    };

    await new SnapshotCache(driver).capture(TARGET, populatedMetrics());

    expect(stored).toEqual([
      [
        TARGET,
        {
          snapshotCount: [
            { labels: { datastore: "slow-xfs", namespace: "" }, value: 4 },
          ],
          snapshotVmCount: [{ labels: VM_LABELS, value: 2 }],
          snapshotVmLastTimestamp: [
            { labels: VM_LABELS, value: LAST_TIMESTAMP },
          ],
          snapshotVmLastVerify: [{ labels: VM_LABELS, value: 1 }],
        },
      ],
    ]);
    // pbs_snapshot_vm_last_age is deliberately not stored — it is recomputed.
    expect(Object.keys(stored[0]?.[1] ?? {})).not.toContain(
      "snapshotVmLastAge",
    );
  });

  it("overwrites a target's entry on every capture", async () => {
    const c = cache();
    await c.capture(TARGET, populatedMetrics(1000));
    await c.capture(TARGET, populatedMetrics(2000));

    const fresh = emptyMetrics();
    await c.apply(TARGET, fresh, 0);
    expect(await valueOf(fresh.snapshotVmLastTimestamp)).toBe(2000);
  });
});

describe("SnapshotCache.apply", () => {
  it("replays the cached series into fresh metrics", async () => {
    const c = cache();
    await c.capture(TARGET, populatedMetrics());

    const fresh = emptyMetrics();
    expect(await c.apply(TARGET, fresh, 1_781_000_000_000)).toBe(true);

    expect(await valueOf(fresh.snapshotCount)).toBe(4);
    expect(await valueOf(fresh.snapshotVmCount)).toBe(2);
    expect(await valueOf(fresh.snapshotVmLastTimestamp)).toBe(LAST_TIMESTAMP);
    expect(await valueOf(fresh.snapshotVmLastVerify)).toBe(1);
    // Labels are preserved verbatim.
    const vmCount = await fresh.snapshotVmCount.get();
    expect(vmCount.values[0]?.labels).toEqual(VM_LABELS);
  });

  it("recomputes the last-backup age against now, so it keeps growing", async () => {
    const c = cache();
    await c.capture(TARGET, populatedMetrics());

    const nowMs = 1_781_000_000_000;
    const fresh = emptyMetrics();
    await c.apply(TARGET, fresh, nowMs);
    expect(await valueOf(fresh.snapshotVmLastAge)).toBe(
      Math.floor(nowMs / 1000) - LAST_TIMESTAMP,
    );

    // ...and further still on a later scrape of the same cached entry.
    const later = emptyMetrics();
    await c.apply(TARGET, later, nowMs + 60_000);
    expect(await valueOf(later.snapshotVmLastAge)).toBe(
      Math.floor(nowMs / 1000) - LAST_TIMESTAMP + 60,
    );
  });

  it("leaves the metrics untouched for an uncached target", async () => {
    const c = cache();
    await c.capture(TARGET, populatedMetrics());

    const fresh = emptyMetrics();
    expect(await c.apply(OTHER_TARGET, fresh, Date.now())).toBe(false);
    const counts = await fresh.snapshotCount.get();
    expect(counts.values).toHaveLength(0);
  });
});

describe("SnapshotCache.has / reset", () => {
  it("knows which targets are cached", async () => {
    const c = cache();
    await c.capture(TARGET, populatedMetrics());
    expect(await c.has(TARGET)).toBe(true);
    expect(await c.has(OTHER_TARGET)).toBe(false);
  });

  it("drops every entry on reset", async () => {
    const c = cache();
    await c.capture(TARGET, populatedMetrics());
    await c.reset();
    expect(await c.has(TARGET)).toBe(false);
  });
});

function config(overrides: Partial<Config> = {}): Config {
  return {
    endpoint: "",
    username: "root@pam",
    apiToken: "",
    apiTokenName: "pbs-exporter",
    timeout: 5000,
    insecure: false,
    cacheSnapshots: true,
    cacheDriver: "memory",
    cacheFsPath: "/cache",
    metricsPath: "/metrics",
    listenAddress: ":10019",
    loglevel: "info",
    logFormat: "text",
    showVersion: false,
    ...overrides,
  };
}

describe("createSnapshotCache", () => {
  it("builds the memory-backed cache by default", () => {
    expect(createSnapshotCache(config(), testLogger).driverName).toBe("memory");
  });

  it("builds the fs-backed cache when the fs driver is configured", () => {
    const c = createSnapshotCache(
      // A path that is never touched: constructing the driver must not do I/O.
      config({ cacheDriver: "fs", cacheFsPath: "/nonexistent/pbs-cache" }),
      testLogger,
    );
    expect(c.driverName).toBe("fs");
  });
});
