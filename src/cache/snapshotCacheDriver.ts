/**
 * Storage contract for the stale-snapshot cache.
 *
 * The cache itself ([`snapshotCache.ts`](./snapshotCache.ts)) only knows how to
 * turn `pbs_snapshot_*` gauges into plain {@link SnapshotCacheEntry} records and
 * back; *where* those records live is the driver's job. Two drivers ship with
 * the exporter:
 *
 * - {@link MemorySnapshotCacheDriver} (`memory`, the default) — a plain `Map`,
 *   lost on restart;
 * - {@link FsSnapshotCacheDriver} (`fs`) — a JSON file under `pbs.cache-fs-path`,
 *   so cached snapshots survive a container restart.
 *
 * Every method is async so a driver may hit the filesystem (or, later, another
 * backend) without changing its callers.
 */

/** A single gauge series: its label values and the last observed value. */
export type MetricSample = { labels: Record<string, string>; value: number };

/** The cached `pbs_snapshot_*` series for one target. */
export type SnapshotCacheEntry = {
  snapshotCount: MetricSample[];
  snapshotVmCount: MetricSample[];
  snapshotVmLastTimestamp: MetricSample[];
  snapshotVmLastVerify: MetricSample[];
};

/** A place to keep {@link SnapshotCacheEntry} records, keyed by resolved target. */
export type SnapshotCacheDriver = {
  /** Short name of the driver, as configured by `pbs.cache-driver`. */
  readonly name: "memory" | "fs";
  /** The cached entry for a target, or `undefined` if there is none. */
  get(target: string): Promise<SnapshotCacheEntry | undefined>;
  /** Store (overwriting) the entry for a target. */
  set(target: string, entry: SnapshotCacheEntry): Promise<void>;
  /** Drop every cached entry. */
  clear(): Promise<void>;
};
