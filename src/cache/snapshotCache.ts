/**
 * Cache of the `pbs_snapshot_*` metric series, keyed by resolved target
 * endpoint.
 *
 * PBS instances that are powered off outside a backup window (e.g. a homelab
 * that only boots to run backups) become unreachable, which makes a scrape fail
 * and drops every `pbs_snapshot_*` series — Grafana then shows "No data" for
 * backup age/count panels even though the underlying snapshots have not changed.
 *
 * When `pbs.snapshots.cache` is enabled, the server captures these series after
 * each successful scrape (see {@link SnapshotCache.capture}) and re-emits them
 * on a subsequent failed scrape (see {@link SnapshotCache.apply}). Only the
 * `pbs_snapshot_*` metrics are cached; `pbs_up`, host/datastore/subscription
 * metrics and error logging behave exactly as when the cache is disabled.
 *
 * `pbs_snapshot_vm_last_age` is *not* stored — it is recomputed from the cached
 * `pbs_snapshot_vm_last_timestamp` at emit time so it keeps growing while PBS is
 * offline (REQ-SCRAPE-6).
 *
 * Where the entries live is decided by the configured driver
 * (`pbs.cache-driver`): `memory` (default, lost on restart) or `fs` (a JSON file
 * under `pbs.cache-fs-path`, surviving container restarts — REQ-SCRAPE-7).
 */

import type { Logger } from "winston";
import type { Config } from "../config.ts";
import type { Metrics } from "../metrics.ts";
import type {
  MetricSample,
  SnapshotCacheDriver,
} from "./snapshotCacheDriver.ts";
import { MemorySnapshotCacheDriver } from "./snapshotCacheMemoryDriver.ts";
import { FsSnapshotCacheDriver } from "./snapshotCacheFsDriver.ts";

export type {
  MetricSample,
  SnapshotCacheDriver,
  SnapshotCacheEntry,
} from "./snapshotCacheDriver.ts";
export { MemorySnapshotCacheDriver } from "./snapshotCacheMemoryDriver.ts";
export { FsSnapshotCacheDriver } from "./snapshotCacheFsDriver.ts";

/** Read the current series of a gauge as plain, cloneable samples. */
async function samplesOf(
  gauge: Metrics[keyof Metrics],
): Promise<MetricSample[]> {
  const { values } = await gauge.get();
  return values.map((v) => {
    const labels: Record<string, string> = {};
    for (const [key, value] of Object.entries(v.labels)) {
      labels[key] = String(value);
    }
    return { labels, value: v.value };
  });
}

export class SnapshotCache {
  readonly #driver: SnapshotCacheDriver;

  constructor(driver: SnapshotCacheDriver) {
    this.#driver = driver;
  }

  /** Short name of the backing driver (`memory` / `fs`). */
  get driverName(): SnapshotCacheDriver["name"] {
    return this.#driver.name;
  }

  /**
   * Snapshot the `pbs_snapshot_*` series from a just-completed successful scrape
   * so they can be replayed while the target is offline. Overwrites any prior
   * cache for the target.
   */
  async capture(target: string, m: Metrics): Promise<void> {
    await this.#driver.set(target, {
      snapshotCount: await samplesOf(m.snapshotCount),
      snapshotVmCount: await samplesOf(m.snapshotVmCount),
      snapshotVmLastTimestamp: await samplesOf(m.snapshotVmLastTimestamp),
      snapshotVmLastVerify: await samplesOf(m.snapshotVmLastVerify),
    });
  }

  /** Whether a cached snapshot entry exists for the target. */
  async has(target: string): Promise<boolean> {
    return (await this.#driver.get(target)) !== undefined;
  }

  /**
   * Re-emit the cached `pbs_snapshot_*` series into the fresh per-scrape metrics
   * after a failed scrape. `pbs_snapshot_vm_last_age` is recomputed from the
   * cached timestamp so it advances while PBS is offline.
   *
   * @returns `true` if cached series were emitted, `false` if the target has no
   * cache entry (in which case the metrics are left untouched).
   */
  async apply(target: string, m: Metrics, nowMs: number): Promise<boolean> {
    const entry = await this.#driver.get(target);
    if (!entry) {
      return false;
    }

    for (const s of entry.snapshotCount) {
      m.snapshotCount.set(s.labels, s.value);
    }
    for (const s of entry.snapshotVmCount) {
      m.snapshotVmCount.set(s.labels, s.value);
    }
    for (const s of entry.snapshotVmLastVerify) {
      m.snapshotVmLastVerify.set(s.labels, s.value);
    }

    const nowSeconds = Math.floor(nowMs / 1000);
    for (const s of entry.snapshotVmLastTimestamp) {
      m.snapshotVmLastTimestamp.set(s.labels, s.value);
      m.snapshotVmLastAge.set(s.labels, nowSeconds - s.value);
    }
    return true;
  }

  /** Clear all cached snapshot series — used by tests. */
  async reset(): Promise<void> {
    await this.#driver.clear();
  }
}

/**
 * Build the snapshot cache for the resolved configuration: an `fs`-backed cache
 * writing into `pbs.cache-fs-path`, or the default in-memory one.
 */
export function createSnapshotCache(
  config: Config,
  log: Logger,
): SnapshotCache {
  return new SnapshotCache(
    config.cacheDriver === "fs"
      ? new FsSnapshotCacheDriver(config.cacheFsPath, log)
      : new MemorySnapshotCacheDriver(),
  );
}
