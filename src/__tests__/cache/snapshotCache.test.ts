import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Registry } from "prom-client";
import { createLogger } from "winston";
import { buildMetrics, type Metrics } from "../../metrics.ts";
import type { Config } from "../../config.ts";
import {
  createSnapshotCache,
  FsSnapshotCacheDriver,
  MemorySnapshotCacheDriver,
  SnapshotCache,
} from "../../cache/snapshotCache.ts";
import { SNAPSHOT_CACHE_FILE } from "../../cache/snapshotCacheFsDriver.ts";
import { testLogger } from "../pbs.fixtures.ts";

const TARGET = "https://pbs.example:8007";
const VM_LABELS = {
  datastore: "slow-xfs",
  namespace: "",
  vm_id: "503",
  vm_name: "web",
};

/** Metrics with the four cacheable `pbs_snapshot_*` series populated. */
function populatedMetrics(lastTimestamp = 1_780_683_922): Metrics {
  const m = buildMetrics(new Registry());
  m.snapshotCount.set({ datastore: "slow-xfs", namespace: "" }, 4);
  m.snapshotVmCount.set(VM_LABELS, 2);
  m.snapshotVmLastTimestamp.set(VM_LABELS, lastTimestamp);
  m.snapshotVmLastVerify.set(VM_LABELS, 1);
  // Not cached: recomputed on apply.
  m.snapshotVmLastAge.set(VM_LABELS, 10);
  return m;
}

/** Empty metrics standing in for a failed scrape. */
function emptyMetrics(): Metrics {
  return buildMetrics(new Registry());
}

async function valueOf(
  gauge: Metrics[keyof Metrics],
): Promise<number | undefined> {
  const { values } = await gauge.get();
  return values[0]?.value;
}

describe("SnapshotCache", () => {
  it("captures the snapshot series and replays them into fresh metrics", async () => {
    const cache = new SnapshotCache(new MemorySnapshotCacheDriver());
    await cache.capture(TARGET, populatedMetrics());

    const fresh = emptyMetrics();
    const nowMs = 1_781_000_000_000;
    expect(await cache.apply(TARGET, fresh, nowMs)).toBe(true);

    expect(await valueOf(fresh.snapshotCount)).toBe(4);
    expect(await valueOf(fresh.snapshotVmCount)).toBe(2);
    expect(await valueOf(fresh.snapshotVmLastTimestamp)).toBe(1_780_683_922);
    expect(await valueOf(fresh.snapshotVmLastVerify)).toBe(1);
    // Age is recomputed against "now", not restored from the cache.
    expect(await valueOf(fresh.snapshotVmLastAge)).toBe(
      Math.floor(nowMs / 1000) - 1_780_683_922,
    );
    // Labels are preserved verbatim.
    const vmCount = await fresh.snapshotVmCount.get();
    expect(vmCount.values[0]?.labels).toEqual(VM_LABELS);
  });

  it("reports and applies nothing for an unknown target", async () => {
    const cache = new SnapshotCache(new MemorySnapshotCacheDriver());
    await cache.capture(TARGET, populatedMetrics());

    const fresh = emptyMetrics();
    expect(await cache.has("https://other:8007")).toBe(false);
    expect(await cache.apply("https://other:8007", fresh, Date.now())).toBe(
      false,
    );
    const counts = await fresh.snapshotCount.get();
    expect(counts.values).toHaveLength(0);
    expect(await cache.has(TARGET)).toBe(true);
  });

  it("overwrites a target's entry on every capture", async () => {
    const cache = new SnapshotCache(new MemorySnapshotCacheDriver());
    await cache.capture(TARGET, populatedMetrics(1000));
    await cache.capture(TARGET, populatedMetrics(2000));

    const fresh = emptyMetrics();
    await cache.apply(TARGET, fresh, 0);
    expect(await valueOf(fresh.snapshotVmLastTimestamp)).toBe(2000);
  });

  it("drops every entry on reset", async () => {
    const cache = new SnapshotCache(new MemorySnapshotCacheDriver());
    await cache.capture(TARGET, populatedMetrics());
    await cache.reset();
    expect(await cache.has(TARGET)).toBe(false);
  });

  it("exposes the driver name", () => {
    expect(new SnapshotCache(new MemorySnapshotCacheDriver()).driverName).toBe(
      "memory",
    );
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
    expect(
      createSnapshotCache(config({ cacheDriver: "fs" }), testLogger).driverName,
    ).toBe("fs");
  });
});

describe("FsSnapshotCacheDriver", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "pbs-snapshot-cache-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const cacheFile = () => path.join(directory, SNAPSHOT_CACHE_FILE);

  it("writes the captured entries to snapshots-cache.json", async () => {
    const cache = new SnapshotCache(
      new FsSnapshotCacheDriver(directory, testLogger),
    );
    await cache.capture(TARGET, populatedMetrics());

    const document_: unknown = JSON.parse(await readFile(cacheFile(), "utf8"));
    expect(document_).toMatchObject({
      version: 1,
      targets: {
        [TARGET]: {
          snapshotCount: [
            { labels: { datastore: "slow-xfs", namespace: "" }, value: 4 },
          ],
          snapshotVmLastTimestamp: [
            { labels: VM_LABELS, value: 1_780_683_922 },
          ],
        },
      },
    });
  });

  it("restores the cache from disk in a new process (container restart)", async () => {
    const before = new SnapshotCache(
      new FsSnapshotCacheDriver(directory, testLogger),
    );
    await before.capture(TARGET, populatedMetrics());

    // A fresh driver over the same directory stands in for a restarted process.
    const after = new SnapshotCache(
      new FsSnapshotCacheDriver(directory, testLogger),
    );
    const fresh = emptyMetrics();
    expect(await after.has(TARGET)).toBe(true);
    expect(await after.apply(TARGET, fresh, 1_781_000_000_000)).toBe(true);
    expect(await valueOf(fresh.snapshotVmLastTimestamp)).toBe(1_780_683_922);
    expect(await valueOf(fresh.snapshotVmLastAge)).toBe(316_078);
  });

  it("starts empty when the cache file does not exist yet", async () => {
    const cache = new SnapshotCache(
      new FsSnapshotCacheDriver(
        path.join(directory, "does", "not", "exist"),
        testLogger,
      ),
    );
    expect(await cache.has(TARGET)).toBe(false);
  });

  it("creates the cache directory on first write", async () => {
    const nested = path.join(directory, "nested", "cache");
    const cache = new SnapshotCache(
      new FsSnapshotCacheDriver(nested, testLogger),
    );
    await cache.capture(TARGET, populatedMetrics());

    const raw = await readFile(path.join(nested, SNAPSHOT_CACHE_FILE), "utf8");
    expect(raw).toContain(TARGET);
  });

  it("ignores a corrupt cache file instead of failing the scrape", async () => {
    await writeFile(cacheFile(), "{ not json", "utf8");
    const log = createLogger({ silent: true });
    const warn = vi.spyOn(log, "warn");

    const cache = new SnapshotCache(new FsSnapshotCacheDriver(directory, log));
    expect(await cache.has(TARGET)).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("ignoring unreadable"),
    );

    // ...and the next capture rewrites a valid document.
    await cache.capture(TARGET, populatedMetrics());
    expect(await cache.has(TARGET)).toBe(true);
  });

  it("skips entries whose shape does not match", async () => {
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

    const cache = new SnapshotCache(
      new FsSnapshotCacheDriver(directory, testLogger),
    );
    expect(await cache.has(TARGET)).toBe(false);

    const fresh = emptyMetrics();
    expect(await cache.apply("https://good:8007", fresh, 0)).toBe(true);
    expect(await valueOf(fresh.snapshotCount)).toBe(7);
    // The non-numeric sample was dropped rather than emitted.
    const verify = await fresh.snapshotVmLastVerify.get();
    expect(verify.values).toHaveLength(0);
  });

  it("logs and carries on when the cache file cannot be written", async () => {
    const log = createLogger({ silent: true });
    const warn = vi.spyOn(log, "warn");
    // A file where the cache directory should be makes mkdir/write fail.
    const blocked = path.join(directory, "blocked");
    await writeFile(blocked, "not a directory", "utf8");

    const cache = new SnapshotCache(new FsSnapshotCacheDriver(blocked, log));
    await expect(
      cache.capture(TARGET, populatedMetrics()),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("unable to write"),
    );
    // The in-memory mirror still answers, so scrapes keep working.
    expect(await cache.has(TARGET)).toBe(true);
  });

  it("clears both the mirror and the file", async () => {
    const cache = new SnapshotCache(
      new FsSnapshotCacheDriver(directory, testLogger),
    );
    await cache.capture(TARGET, populatedMetrics());
    await cache.reset();

    expect(await cache.has(TARGET)).toBe(false);
    const raw = await readFile(cacheFile(), "utf8");
    expect(JSON.parse(raw)).toEqual({ version: 1, targets: {} });
  });
});
