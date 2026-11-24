---
name: dexie-redux-rehydration
description: Use whenever adding or changing a Dexie write, a repository, or a Redux slice that holds survey/job data. Guarantees every write has a rehydration-on-load step so state survives refresh.
---

# Dexie ⇄ Redux rehydration

**Principle:** Dexie is the source of truth. Redux is a cache/projection that must be rebuildable from Dexie at any time.

## Steps for any new persisted entity
1. **Type** in `src/types/` (include `id`, `updatedAt`, `rev`).
2. **Table + indexes** → see `dexie-schema-versioning` (bump version).
3. **Repository** `src/data/repos/<entity>Repo.ts` — the *only* code that touches `db.<table>`:
   ```ts
   export const itemsRepo = {
     async save(item: ChecklistItemState) {
       await db.checklistItems.put({ ...item, updatedAt: Date.now() });
       await syncQueue.enqueue('checklistItem', item.id);
     },
     listBySession: (sessionId: string) =>
       db.checklistItems.where('sessionId').equals(sessionId).toArray(),
   };
   ```
4. **Hydrator** `src/data/hydration/<entity>.hydrator.ts`:
   ```ts
   export const hydrateChecklist: Hydrator = async ({ dispatch, jobId }) => {
     const session = await sessionsRepo.getByJob(jobId);
     if (!session) return;
     dispatch(checklistHydrated(await itemsRepo.listBySession(session.id)));
   };
   ```
5. **Register** in `src/data/hydration/registry.ts` with scope `'app' | 'job'`.
6. **Slice** gets a `…Hydrated` reducer (replaces entity state) and a `hydrationStatus`.
7. **Thunk pattern** — Dexie first, then Redux:
   ```ts
   export const saveItem = createAsyncThunk('checklist/save', async (item) => {
     await itemsRepo.save(item);   // throws => Redux untouched
     return item;
   });
   ```
8. **Boot**: `bootstrap()` awaits `runHydrators('app')` before the router renders protected routes; job routes call `runHydrators('job', {jobId})` in the route loader. Show skeletons while `hydrationStatus !== 'ready'`.
9. **Test** (mandatory): write via repo → new store → `runHydrators` → expect equal. Also e2e: reload keeps data.

## Anti-patterns (each caused a real bug)
- Writing to Dexie but only reading from Redux after reload ⇒ "job disappears on refresh".
- Dispatching before the Dexie write resolves ⇒ UI shows data that was never saved.
- Rendering an empty state before hydration finishes ⇒ looks like data loss.
- Persisting the whole store blob (redux-persist) instead of normalized tables.
- Putting Blobs in Redux.

## Review checklist
- [ ] repo method  - [ ] hydrator registered  - [ ] reducer  - [ ] status/skeleton  - [ ] round-trip test
