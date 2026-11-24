---
name: dexie-schema-versioning
description: Use when adding/changing Dexie tables, indexes, or queries. Enforces append-only schema versions and index coverage to prevent silent indexing/SchemaError failures.
---

# Dexie schema versioning

## Rules
1. Schema lives in `src/data/db/schema.ts` as an ordered list. **Append only** — never edit a shipped version.
2. Any change to store strings (new table, new/changed index, primary key) ⇒ new `db.version(n+1).stores({...})` with the **full** store map for tables you touch, plus `.upgrade(tx => …)` if data must be transformed/backfilled.
3. **Every field used in `where()`, `orderBy()`, `sortBy`-on-key, or `.equals/.between` must be indexed.** Queries on un-indexed fields throw or return nothing — this caused job fetch failures.
4. Use compound indexes for real access patterns: `checklistItems: 'id, [sessionId+floorCode], [sessionId+itemCode+floorCode], sessionId, updatedAt'`.
5. Don't index Blobs or large JSON. Booleans aren't valid index keys — store `0|1` or a string status.
6. Primary keys are client UUIDs (offline-created records).

## Template
```ts
// schema.ts
export const versions = [
  { v: 1, stores: { jobs: 'id, status, assignedTo, scheduledDate', syncQueue: '++seq, status, entity' } },
  { v: 2, stores: { checklistItems: 'id, sessionId, [sessionId+floorCode]' },
    upgrade: undefined },
  { v: 3, stores: { jobs: 'id, status, assignedTo, scheduledDate, [assignedTo+status]' },
    upgrade: (tx) => tx.table('jobs').toCollection().modify(j => { j.attempt ??= 1; }) },
] as const;
versions.forEach(({ v, stores, upgrade }) => {
  const ver = db.version(v).stores(stores);
  if (upgrade) ver.upgrade(upgrade);
});
```

## Procedure when adding a query
1. Write the repository query.
2. Add the field/compound index to a **new** version.
3. Update `queryDeclarations` in the repo (`export const queries = { listBySession: ['sessionId'] }`).
4. Run `schema.test.ts` — it asserts declared query fields ⊆ latest indexes, versions are strictly increasing, and earlier version snapshots are unchanged.
5. Add an upgrade test with a fixture DB at v(n-1).

## Error handling
Handle `VersionError`, `UpgradeError`, `QuotaExceededError`, blocked upgrade (other tab open: `db.on('blocked')`). Provide a user-facing recovery path that never deletes un-synced data without explicit confirmation/export.
