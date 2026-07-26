/**
 * In-memory {@link SnapshotCacheDriver} — the default (`pbs.cache-driver=memory`).
 *
 * Entries live in a plain `Map` for the lifetime of the process: the cache is
 * empty after every restart and is repopulated by the first successful scrape.
 * Use the `fs` driver ([`snapshotCacheFsDriver.ts`](./snapshotCacheFsDriver.ts))
 * when cached snapshots must survive a container restart.
 */

import type {
  SnapshotCacheDriver,
  SnapshotCacheEntry,
} from "./snapshotCacheDriver.ts";

export class MemorySnapshotCacheDriver implements SnapshotCacheDriver {
  readonly #store = new Map<string, SnapshotCacheEntry>();

  readonly name = "memory";

  get(target: string): Promise<SnapshotCacheEntry | undefined> {
    return Promise.resolve(this.#store.get(target));
  }

  set(target: string, entry: SnapshotCacheEntry): Promise<void> {
    this.#store.set(target, entry);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.#store.clear();
    return Promise.resolve();
  }
}
