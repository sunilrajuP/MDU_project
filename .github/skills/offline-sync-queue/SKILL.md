---
name: offline-sync-queue
description: Use when implementing sync, outbox, media upload, save/sync status, or conflict handling for offline capture.
---

# Offline sync queue

## Outbox table
`syncQueue: '++seq, status, entity, [entity+entityId]'` — fields: `entity`, `entityId`, `op ('put'|'delete')`, `rev`, `status ('pending'|'inflight'|'failed'|'done')`, `attempts`, `lastError`, `createdAt`.

## Behaviour
1. Repo write → Dexie put + enqueue (same Dexie transaction: `db.transaction('rw', table, db.syncQueue, …)`).
2. Worker runs on: app start, `online` event, visibility change, manual "Retry".
3. Coalesce multiple pending ops for the same entity; send latest `rev`.
4. Order: job/survey metadata → checklist/plan objects → media (chunked, resumable) → sign-off → submit.
5. Backoff (e.g. 2s, 10s, 60s, cap) for network/5xx; 4xx marks `failed` and shows an actionable error.
6. Idempotent: client UUIDs; server returns accepted `rev`.
7. On success mark `done`; purge after confirmation; **never delete local data because sync succeeded unless storage pressure policy says so** and media is confirmed on the server.
8. Submit offline ⇒ `submitPending=true`; survey stays read-only (signed); sync on reconnect.

## Status surface
Selector `selectSyncStatus` ⇒ `saved-local | syncing(n) | synced | failed(n)`; rendered by `SyncStatusBadge` on every screen header. A failed state must offer Retry and not hide the error.

## Conflicts
Single owner per survey ⇒ per-entity last-write-wins using `rev` then `updatedAt`. Manager-owned fields (job metadata, status after review) are separate from surveyor-owned survey data. A server `Returned` status re-opens the survey locally for the owner and keeps local edits.

## Tests
Simulate offline → capture → reload → online → assert server received once; force failure → data intact → retry succeeds.
