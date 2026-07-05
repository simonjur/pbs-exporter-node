# 7. Metrics

> Part of the [PBS Exporter specification](../SPEC.md). See the index for the
> spec-driven-development workflow and the meaning of **[offline-ok]** / **[needs-pbs]**.

All metric names are prefixed `pbs_`. Type is gauge unless noted.

| ID | Metric | Labels | Help |
|----|--------|--------|------|
| REQ-M-1 | `pbs_up` | — | Was the last query of PBS successful. |
| REQ-M-2 | `pbs_version` | version, repoid, release | Version of the PBS installation. (value 1) |
| REQ-M-3 | `pbs_available` | datastore | Available bytes of the underlying storage. |
| REQ-M-4 | `pbs_size` | datastore | Size of the underlying storage in bytes. |
| REQ-M-5 | `pbs_used` | datastore | Used bytes of the underlying storage. |
| REQ-M-6 | `pbs_snapshot_count` | datastore, namespace | Total number of backups. |
| REQ-M-7 | `pbs_snapshot_vm_count` | datastore, namespace, vm_id, vm_name | Total number of backups per VM. |
| REQ-M-8 | `pbs_snapshot_vm_last_timestamp` | datastore, namespace, vm_id, vm_name | Timestamp of the last backup of a VM. |
| REQ-M-9 | `pbs_snapshot_vm_last_age` | datastore, namespace, vm_id, vm_name | Age in seconds of the last backup of a VM (now - `pbs_snapshot_vm_last_timestamp`). |
| REQ-M-10 | `pbs_snapshot_vm_last_verify` | datastore, namespace, vm_id, vm_name | Verify status of the last backup of a VM (1 if `ok`, else 0). |
| REQ-M-11 | `pbs_host_subscription_status` | status | Subscription status of the host (1 for the active status string, 0 for the rest). |
| REQ-M-12 | `pbs_host_subscription_info` | productname, status | Subscription info of the host. (value 1) |
| REQ-M-13 | `pbs_host_subscription_due_timestamp_seconds` | productname | Subscription next due timestamp (unix seconds). |
| REQ-M-14 | `pbs_host_cpu_usage` | — | CPU usage of the host. |
| REQ-M-15 | `pbs_host_memory_free` / `_total` / `_used` | — | Host memory. |
| REQ-M-16 | `pbs_host_swap_free` / `_total` / `_used` | — | Host swap. |
| REQ-M-17 | `pbs_host_disk_available` / `_total` / `_used` | — | Local root disk bytes. |
| REQ-M-18 | `pbs_host_uptime` | — | Uptime of the host. |
| REQ-M-19 | `pbs_host_io_wait` | — | IO wait of the host. |
| REQ-M-20 | `pbs_host_load1` / `load5` / `load15` | — | Host load averages (loadavg[0/1/2]). |

**Verify [offline-ok]:** every `# HELP pbs_<name>` and `# TYPE` line is present in `/metrics`
output (names/labels/help match this table exactly) even when `pbs_up 0`, because the
gauges are declared per scrape. **[needs-pbs]** for populated values.

When `pbs.snapshots.cache` is enabled, the `pbs_snapshot_*` series (REQ-M-6 … REQ-M-10)
may be populated from a cache after a failed scrape rather than from a live PBS response;
see `REQ-SCRAPE-6`.
