/**
 * Filesystem {@link SnapshotCacheDriver} (`pbs.cache-driver=fs`).
 *
 * Cached `pbs_snapshot_*` series are mirrored to a single JSON document,
 * `snapshots-cache.json`, inside the directory configured by
 * `pbs.cache-fs-path`. Mounting that directory as a volume means a container
 * restart no longer loses the cache: the exporter can keep serving the last
 * known snapshot values even if it is restarted while PBS is powered off
 * (`REQ-SCRAPE-7`).
 *
 * The on-disk document is:
 *
 * ```json
 * { "version": 1, "targets": { "https://pbs.example:8007": { … } } }
 * ```
 *
 * An in-memory mirror is kept so reads never touch the disk after the initial
 * load, and writes are serialized and atomic (write a temp file, then rename).
 * The cache is best-effort: any filesystem or parse error is logged and the
 * exporter carries on with the in-memory mirror — a broken cache directory must
 * never fail a scrape.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Logger } from "winston";
import type {
  SnapshotCacheDriver,
  SnapshotCacheEntry,
} from "./snapshotCacheDriver.ts";

/** Name of the JSON document written inside the configured cache directory. */
export const SNAPSHOT_CACHE_FILE = "snapshots-cache.json";

/** Format version of the document, bumped if its shape ever changes. */
const FORMAT_VERSION = 1;

type CacheDocument = {
  version: number;
  targets: Record<string, SnapshotCacheEntry>;
};

const SAMPLE_KEYS = [
  "snapshotCount",
  "snapshotVmCount",
  "snapshotVmLastTimestamp",
  "snapshotVmLastVerify",
] as const;

export class FsSnapshotCacheDriver implements SnapshotCacheDriver {
  readonly #file: string;
  readonly #directory: string;
  readonly #log: Logger;

  /** Mirror of the document, so reads never hit the disk after loading. */
  #entries = new Map<string, SnapshotCacheEntry>();
  /** The one-shot initial load; `undefined` until the first access. */
  #load: Promise<void> | undefined;
  /** Serializes writes so overlapping scrapes cannot interleave file writes. */
  #writes: Promise<void> = Promise.resolve();

  readonly name = "fs";

  constructor(directory: string, log: Logger) {
    this.#directory = directory;
    this.#file = path.join(directory, SNAPSHOT_CACHE_FILE);
    this.#log = log;
  }

  /** Read the document once per process; a missing/corrupt file starts empty. */
  #ensureLoaded(): Promise<void> {
    this.#load ??= this.#read();
    return this.#load;
  }

  async #read(): Promise<void> {
    let raw: string;
    try {
      raw = await readFile(this.#file, "utf8");
    } catch (error) {
      // A missing file is the normal first-start case, not a problem.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.#log.warn(
          `Snapshot cache: unable to read ${this.#file}: ${message(error)}`,
        );
      }
      return;
    }

    try {
      this.#entries = parseDocument(raw);
      this.#log.debug(
        `Snapshot cache: loaded ${this.#entries.size} target(s) from ${this.#file}`,
      );
    } catch (error) {
      this.#log.warn(
        `Snapshot cache: ignoring unreadable ${this.#file}: ${message(error)}`,
      );
    }
  }

  /** Queue an atomic rewrite of the whole document behind any pending write. */
  #persist(): Promise<void> {
    this.#writes = this.#writeAfter(this.#writes);
    return this.#writes;
  }

  async #writeAfter(pending: Promise<void>): Promise<void> {
    await pending;
    await this.#write();
  }

  async #write(): Promise<void> {
    const document_: CacheDocument = {
      version: FORMAT_VERSION,
      targets: Object.fromEntries(this.#entries),
    };
    // Write-then-rename so a crash mid-write cannot leave a truncated document.
    const temporary = `${this.#file}.tmp`;
    try {
      await mkdir(this.#directory, { recursive: true });
      await writeFile(temporary, JSON.stringify(document_), "utf8");
      await rename(temporary, this.#file);
    } catch (error) {
      this.#log.warn(
        `Snapshot cache: unable to write ${this.#file}: ${message(error)}`,
      );
    }
  }

  async get(target: string): Promise<SnapshotCacheEntry | undefined> {
    await this.#ensureLoaded();
    return this.#entries.get(target);
  }

  async set(target: string, entry: SnapshotCacheEntry): Promise<void> {
    await this.#ensureLoaded();
    this.#entries.set(target, entry);
    await this.#persist();
  }

  async clear(): Promise<void> {
    await this.#ensureLoaded();
    this.#entries.clear();
    await this.#persist();
  }
}

/** Parse the document, keeping only entries that have the expected shape. */
function parseDocument(raw: string): Map<string, SnapshotCacheEntry> {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || !isRecord(parsed.targets)) {
    throw new Error("unexpected document shape");
  }

  const entries = new Map<string, SnapshotCacheEntry>();
  for (const [target, value] of Object.entries(parsed.targets)) {
    const entry = toEntry(value);
    if (entry) {
      entries.set(target, entry);
    }
  }
  return entries;
}

function toEntry(value: unknown): SnapshotCacheEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const entry = {} as SnapshotCacheEntry;
  for (const key of SAMPLE_KEYS) {
    const samples = value[key];
    if (!Array.isArray(samples)) {
      return undefined;
    }
    entry[key] = samples.filter(
      (sample) =>
        isRecord(sample) &&
        typeof sample.value === "number" &&
        isRecord(sample.labels),
    ) as SnapshotCacheEntry[typeof key];
  }
  return entry;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
