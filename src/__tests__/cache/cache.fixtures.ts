/**
 * Shared fixtures for the snapshot-cache tests (`src/cache/`): metric builders
 * for the four cacheable `pbs_snapshot_*` series, the plain cache entries the
 * drivers store, and a temp-directory helper for the `fs` driver.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Registry } from "prom-client";
import { buildMetrics, type Metrics } from "../../metrics.ts";
import type { SnapshotCacheEntry } from "../../cache/snapshotCacheDriver.ts";

export const TARGET = "https://pbs.example:8007";
export const OTHER_TARGET = "https://other.example:8007";

export const DATASTORE_LABELS = { datastore: "slow-xfs", namespace: "" };
export const VM_LABELS = {
  datastore: "slow-xfs",
  namespace: "",
  vm_id: "503",
  vm_name: "web",
};

/** The timestamp of the fixture's last backup, in unix seconds. */
export const LAST_TIMESTAMP = 1_780_683_922;

/** Metrics with the four cacheable `pbs_snapshot_*` series populated. */
export function populatedMetrics(lastTimestamp = LAST_TIMESTAMP): Metrics {
  const m = buildMetrics(new Registry());
  m.snapshotCount.set(DATASTORE_LABELS, 4);
  m.snapshotVmCount.set(VM_LABELS, 2);
  m.snapshotVmLastTimestamp.set(VM_LABELS, lastTimestamp);
  m.snapshotVmLastVerify.set(VM_LABELS, 1);
  // Not cached: recomputed on apply.
  m.snapshotVmLastAge.set(VM_LABELS, 10);
  return m;
}

/** Empty metrics, standing in for a failed scrape. */
export function emptyMetrics(): Metrics {
  return buildMetrics(new Registry());
}

/** The value of a gauge's first (usually only) series. */
export async function valueOf(
  gauge: Metrics[keyof Metrics],
): Promise<number | undefined> {
  const { values } = await gauge.get();
  return values[0]?.value;
}

/** A plain cache entry, as a driver stores it — no metrics involved. */
export function sampleEntry(count = 4): SnapshotCacheEntry {
  return {
    snapshotCount: [{ labels: DATASTORE_LABELS, value: count }],
    snapshotVmCount: [{ labels: VM_LABELS, value: 2 }],
    snapshotVmLastTimestamp: [{ labels: VM_LABELS, value: LAST_TIMESTAMP }],
    snapshotVmLastVerify: [{ labels: VM_LABELS, value: 1 }],
  };
}

/** A private temp directory for `fs`-driver tests, plus its cleanup. */
export async function makeCacheDirectory(): Promise<{
  directory: string;
  cleanup: () => Promise<void>;
}> {
  const directory = await mkdtemp(path.join(tmpdir(), "pbs-snapshot-cache-"));
  return {
    directory,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}
