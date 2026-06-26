# 8. Behavioral rules

> Part of the [PBS Exporter specification](../SPEC.md). See the index for the
> spec-driven-development workflow and the meaning of **[offline-ok]** / **[needs-pbs]**.

| ID | Requirement | Verify |
|----|-------------|--------|
| REQ-B-1 | `pbs_snapshot_vm_last_verify` is 1 only when the most recent snapshot's `verification.state` == `ok`, else 0. The "most recent" snapshot is the one with the greatest `backup-time` for that `backup-id`. | Stub two snapshots for one vm_id; the later one's state drives the value. **[needs-pbs]** |
| REQ-B-2 | `vm_name` label is taken from the snapshot `comment` field (empty string if absent). | Stub a snapshot with `comment`; label matches. **[needs-pbs]** |
| REQ-B-3 | When `GET .../namespace` returns HTTP 400 with a body matching `/datastore is being deleted/i`, that datastore is skipped (logged at INFO) without failing the whole scrape. | Stub a 400 with that body; scrape still ends with `pbs_up 1`. **[needs-pbs]** |
| REQ-B-4 | Subscription `nextduedate` (format `YYYY-MM-DD`, interpreted as UTC midnight) becomes `pbs_host_subscription_due_timestamp_seconds`; absent/invalid → 0. | Stub `nextduedate: "2026-01-01"` → metric == `1767225600`. **[needs-pbs]** |
| REQ-B-5 | `pbs_host_subscription_status` is emitted for each of: `new`, `notfound`, `active`, `invalid`, `expired`, `suspended`, with value 1 for the matching status and 0 otherwise. | Stub `status: active`; only `{status="active"}` == 1. **[needs-pbs]** |
| REQ-B-6 | `pbs_snapshot_vm_last_age` equals the current unix time (whole seconds) minus `pbs_snapshot_vm_last_timestamp` for the same labels, computed at scrape time. | For any vm series, `pbs_snapshot_vm_last_age` ≈ `now - pbs_snapshot_vm_last_timestamp` (±1s). **[needs-pbs]** |
