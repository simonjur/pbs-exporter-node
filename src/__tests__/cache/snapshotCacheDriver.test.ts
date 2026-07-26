/**
 * The contract every {@link SnapshotCacheDriver} must satisfy, run against each
 * shipped driver. Behaviour that is specific to one driver (files on disk,
 * restart survival, process-local storage) lives in that driver's own test.
 */

import { afterEach, describe, expect, it } from "vitest";
import type {
  SnapshotCacheDriver,
  SnapshotCacheEntry,
} from "../../cache/snapshotCacheDriver.ts";
import { MemorySnapshotCacheDriver } from "../../cache/snapshotCacheMemoryDriver.ts";
import { FsSnapshotCacheDriver } from "../../cache/snapshotCacheFsDriver.ts";
import { testLogger } from "../pbs.fixtures.ts";
import {
  makeCacheDirectory,
  OTHER_TARGET,
  sampleEntry,
  TARGET,
} from "./cache.fixtures.ts";

type DriverCase = {
  label: SnapshotCacheDriver["name"];
  make: () => Promise<SnapshotCacheDriver>;
};

/** Cleanups registered by the current test's driver factory. */
const cleanups: Array<() => Promise<void>> = [];

const CASES: DriverCase[] = [
  {
    label: "memory",
    make: () => Promise.resolve(new MemorySnapshotCacheDriver()),
  },
  {
    label: "fs",
    make: async () => {
      const { directory, cleanup } = await makeCacheDirectory();
      cleanups.push(cleanup);
      return new FsSnapshotCacheDriver(directory, testLogger);
    },
  },
];

afterEach(async () => {
  const pending = [...cleanups];
  cleanups.length = 0;
  await Promise.all(pending.map((cleanup) => cleanup()));
});

/** The `pbs_snapshot_count` value of a stored entry, for terse assertions. */
function countOf(entry: SnapshotCacheEntry | undefined): number | undefined {
  return entry?.snapshotCount[0]?.value;
}

describe.each(CASES)(
  "SnapshotCacheDriver contract — $label",
  ({ label, make }) => {
    it("reports its configured name", async () => {
      const driver = await make();
      expect(driver.name).toBe(label);
    });

    it("returns undefined for a target it has never stored", async () => {
      const driver = await make();
      expect(await driver.get(TARGET)).toBeUndefined();
    });

    it("returns a stored entry unchanged", async () => {
      const driver = await make();
      const entry = sampleEntry();
      await driver.set(TARGET, entry);
      expect(await driver.get(TARGET)).toEqual(entry);
    });

    it("keeps targets apart", async () => {
      const driver = await make();
      await driver.set(TARGET, sampleEntry(4));
      await driver.set(OTHER_TARGET, sampleEntry(9));

      expect(countOf(await driver.get(TARGET))).toBe(4);
      expect(countOf(await driver.get(OTHER_TARGET))).toBe(9);
    });

    it("overwrites the entry of a target that is set twice", async () => {
      const driver = await make();
      await driver.set(TARGET, sampleEntry(4));
      await driver.set(TARGET, sampleEntry(11));

      expect(countOf(await driver.get(TARGET))).toBe(11);
    });

    it("forgets everything after clear()", async () => {
      const driver = await make();
      await driver.set(TARGET, sampleEntry());
      await driver.set(OTHER_TARGET, sampleEntry());
      await driver.clear();

      expect(await driver.get(TARGET)).toBeUndefined();
      expect(await driver.get(OTHER_TARGET)).toBeUndefined();
    });

    it("survives concurrent writes to different targets", async () => {
      const driver = await make();
      const targets = ["https://a:8007", "https://b:8007", "https://c:8007"];
      await Promise.all(
        targets.map((target, index) => driver.set(target, sampleEntry(index))),
      );

      for (const [index, target] of targets.entries()) {
        expect(countOf(await driver.get(target))).toBe(index);
      }
    });
  },
);
