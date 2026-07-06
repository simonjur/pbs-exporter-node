/**
 * In-memory cache of the `pbs_snapshot_*` metric series, keyed by resolved
 * target endpoint.
 *
 * PBS instances that are powered off outside a backup window (e.g. a homelab
 * that only boots to run backups) become unreachable, which makes a scrape fail
 * and drops every `pbs_snapshot_*` series — Grafana then shows "No data" for
 * backup age/count panels even though the underlying snapshots have not changed.
 *
 * When `pbs.snapshots.cache` is enabled, the server captures these series after
 * each successful scrape (see {@link captureSnapshotMetrics}) and re-emits them
 * on a subsequent failed scrape (see {@link applyCachedSnapshotMetrics}). Only
 * the `pbs_snapshot_*` metrics are cached; `pbs_up`, host/datastore/subscription
 * metrics and error logging behave exactly as when the cache is disabled.
 *
 * `pbs_snapshot_vm_last_age` is *not* stored — it is recomputed from the cached
 * `pbs_snapshot_vm_last_timestamp` at emit time so it keeps growing while PBS is
 * offline (REQ-SCRAPE-6).
 */

import type { Metrics } from "./metrics.ts";

/** A single gauge series: its label values and the last observed value. */
type MetricSample = { labels: Record<string, string>; value: number };

/** The cached `pbs_snapshot_*` series for one target. */
type SnapshotCacheEntry = {
  snapshotCount: MetricSample[];
  snapshotVmCount: MetricSample[];
  snapshotVmLastTimestamp: MetricSample[];
  snapshotVmLastVerify: MetricSample[];
};

const store = new Map<string, SnapshotCacheEntry>();

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

/**
 * Snapshot the `pbs_snapshot_*` series from a just-completed successful scrape
 * so they can be replayed while the target is offline. Overwrites any prior
 * cache for the target.
 */
export async function captureSnapshotMetrics(
  target: string,
  m: Metrics,
): Promise<void> {
  store.set(target, {
    snapshotCount: await samplesOf(m.snapshotCount),
    snapshotVmCount: await samplesOf(m.snapshotVmCount),
    snapshotVmLastTimestamp: await samplesOf(m.snapshotVmLastTimestamp),
    snapshotVmLastVerify: await samplesOf(m.snapshotVmLastVerify),
  });
}

/** Whether a cached snapshot entry exists for the target. */
export function hasSnapshotCache(target: string): boolean {
  return store.has(target);
}

/**
 * Re-emit the cached `pbs_snapshot_*` series into the fresh per-scrape metrics
 * after a failed scrape. `pbs_snapshot_vm_last_age` is recomputed from the
 * cached timestamp so it advances while PBS is offline. No-op if the target has
 * no cache entry (check {@link hasSnapshotCache} first if you need to know).
 */
export function applyCachedSnapshotMetrics(
  target: string,
  m: Metrics,
  nowMs: number,
): void {
  const entry = store.get(target);
  if (!entry) {
    return;
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
}

/** Clear all cached snapshot series — used by tests. */
export function resetSnapshotCache(): void {
  store.clear();
}
