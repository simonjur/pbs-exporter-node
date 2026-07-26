/**
 * Memory-driver specifics. The shared get/set/clear semantics are covered by
 * the contract suite in `snapshotCacheDriver.test.ts`; what matters here is
 * that the store is per-instance and process-local — nothing is shared between
 * drivers and nothing outlives the process.
 */

import { describe, expect, it } from "vitest";
import { MemorySnapshotCacheDriver } from "../../cache/snapshotCacheMemoryDriver.ts";
import { sampleEntry, TARGET } from "./cache.fixtures.ts";

describe("MemorySnapshotCacheDriver", () => {
  it("is named memory", () => {
    expect(new MemorySnapshotCacheDriver().name).toBe("memory");
  });

  it("keeps each instance's entries to itself", async () => {
    const first = new MemorySnapshotCacheDriver();
    const second = new MemorySnapshotCacheDriver();
    await first.set(TARGET, sampleEntry());

    // No module-level/static store: a second driver starts empty, and a new
    // instance is exactly what the exporter has after a restart.
    expect(await second.get(TARGET)).toBeUndefined();
    expect(await first.get(TARGET)).toBeDefined();
  });

  it("clears one instance without touching another", async () => {
    const first = new MemorySnapshotCacheDriver();
    const second = new MemorySnapshotCacheDriver();
    await first.set(TARGET, sampleEntry());
    await second.set(TARGET, sampleEntry());

    await first.clear();

    expect(await first.get(TARGET)).toBeUndefined();
    expect(await second.get(TARGET)).toBeDefined();
  });

  it("hands back the stored object, not a re-parsed copy", async () => {
    const driver = new MemorySnapshotCacheDriver();
    const entry = sampleEntry();
    await driver.set(TARGET, entry);
    expect(await driver.get(TARGET)).toBe(entry);
  });
});
