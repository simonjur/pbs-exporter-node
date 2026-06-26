/**
 * Prometheus metric definitions for the PBS exporter.
 *
 * Metrics are built fresh per scrape (into a throwaway registry) so that stale
 * label series from previous scrapes are not retained.
 */

import { Registry, Gauge } from "prom-client";

export const PROM_NAMESPACE = "pbs";

export function buildMetrics(registry: Registry) {
  const g = (name: string, help: string, labelNames: string[] = []) =>
    new Gauge({
      name: `${PROM_NAMESPACE}_${name}`,
      help,
      labelNames,
      registers: [registry],
    });

  return {
    up: g("up", "Was the last query of PBS successful."),
    version: g("version", "Version of the PBS installation.", [
      "version",
      "repoid",
      "release",
    ]),
    available: g(
      "available",
      "The available bytes of the underlying storage.",
      ["datastore"],
    ),
    size: g("size", "The size of the underlying storage in bytes.", [
      "datastore",
    ]),
    used: g("used", "The used bytes of the underlying storage.", ["datastore"]),
    snapshotCount: g("snapshot_count", "The total number of backups.", [
      "datastore",
      "namespace",
    ]),
    snapshotVmCount: g(
      "snapshot_vm_count",
      "The total number of backups per VM.",
      ["datastore", "namespace", "vm_id", "vm_name"],
    ),
    snapshotVmLastTimestamp: g(
      "snapshot_vm_last_timestamp",
      "The timestamp of the last backup of a VM.",
      ["datastore", "namespace", "vm_id", "vm_name"],
    ),
    snapshotVmLastAge: g(
      "snapshot_vm_last_age",
      "The age in seconds of the last backup of a VM (now - last timestamp).",
      ["datastore", "namespace", "vm_id", "vm_name"],
    ),
    snapshotVmLastVerify: g(
      "snapshot_vm_last_verify",
      "The verify status of the last backup of a VM.",
      ["datastore", "namespace", "vm_id", "vm_name"],
    ),
    subscriptionStatus: g(
      "host_subscription_status",
      "The subscription status of the host.",
      ["status"],
    ),
    subscriptionInfo: g(
      "host_subscription_info",
      "The subscription info of the host.",
      ["productname", "status"],
    ),
    subscriptionDueTimestamp: g(
      "host_subscription_due_timestamp_seconds",
      "The subscription next due timestamp (unix seconds) of the host.",
      ["productname"],
    ),
    hostCpuUsage: g("host_cpu_usage", "The CPU usage of the host."),
    hostMemoryFree: g("host_memory_free", "The free memory of the host."),
    hostMemoryTotal: g("host_memory_total", "The total memory of the host."),
    hostMemoryUsed: g("host_memory_used", "The used memory of the host."),
    hostSwapFree: g("host_swap_free", "The free swap of the host."),
    hostSwapTotal: g("host_swap_total", "The total swap of the host."),
    hostSwapUsed: g("host_swap_used", "The used swap of the host."),
    hostDiskAvailable: g(
      "host_disk_available",
      "The available disk of the local root disk in bytes.",
    ),
    hostDiskTotal: g(
      "host_disk_total",
      "The total disk of the local root disk in bytes.",
    ),
    hostDiskUsed: g(
      "host_disk_used",
      "The used disk of the local root disk in bytes.",
    ),
    hostUptime: g("host_uptime", "The uptime of the host."),
    hostIoWait: g("host_io_wait", "The io wait of the host."),
    hostLoad1: g("host_load1", "The load for 1 minute of the host."),
    hostLoad5: g("host_load5", "The load for 5 minutes of the host."),
    hostLoad15: g("host_load15", "The load for 15 minutes of the host."),
  };
}

export type Metrics = ReturnType<typeof buildMetrics>;
