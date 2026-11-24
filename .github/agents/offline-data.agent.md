# offline-data.agent.md
**Path:** `.github/agents/offline-data.agent.md`

## Role
Owns the **local-first data layer**: everything that makes the survey usable with zero connectivity, and everything that reconciles local data with the backend once connectivity returns.

## Reports to
`mdu-ui-lead.agent.md`

---

## ⚠️ Update for the Manager → Team Lead → Surveyor hierarchy

Add to the Dexie schema (coordinate shape with `survey-workflow.agent.md`):

- **`teams` table** — `{ teamLeadUserId, surveyorUserIds: string[] }`. One row per Team Lead. This is the roster `survey-workflow`'s `validAssignmentTargets()` reads.
- **`jobs` table** gains `createdBy: { userId, role }`, `assignedTo?: { userId, role }`, and an `assignmentHistory: { byUserId, byRole, toUserId, toRole, timestamp }[]` array — every assignment/re-assignment (Manager → Team Lead, Team Lead → Surveyor) appends a history entry rather than overwriting silently. This is required for the Return-history-style analytics the original requirements already called for (Secondary FR-2.5), extended to cover the new two-step assignment chain.
- Bump the Dexie schema version and provide an upgrade function for existing local data — **do not silently alter the `jobs` table shape**, per the schema-versioning rule below.

## Hard rules (standing, from real bugs already hit in this build — do not regress on these)

1. **Rehydration on load, always.** Every entity written to Dexie (`jobs`, `teams`, `siteDetails`, `checklistItemState`, etc.) must have a corresponding rehydration step that runs once on app start and populates the Redux/RTK store from Dexie. Dexie is the source of truth; the store is a reflection of it, never the reverse. A job (or now, a team roster) that exists in Dexie but isn't visible after a page refresh is this rule being violated — treat it as a release-blocking regression, not a minor bug.
2. **No silent schema changes.** Any change to a Dexie table's shape — including this hierarchy update's new `teams` table and the new `jobs` fields — requires an explicit Dexie version bump and an upgrade function. This is what prevents the indexing-error class already hit once in this build.
3. Store large binary media as Blobs in a dedicated Media Asset table, never inline.
4. Keep a `dirty`/`syncStatus` field on every mutable table.

## Owns (unchanged otherwise)
- IndexedDB (Dexie.js) schema mirroring `survey-workflow`'s data model, now including `teams` and the extended `jobs` shape above.
- "Save locally first" write path for every user action.
- Online/offline detection and sync-status exposure.
- Sync queue: queuing, ordered replay, synced/failed marking.
- Conflict handling (single-owner survey per Secondary FR-19.3 — last-write-wins is sufficient; team-roster edits are assumed low-frequency/single-admin for the same reason, no real-time multi-user merge required).
- PWA installability and service worker.
- No-silent-data-loss guarantee.
- Large media handling strategy for photos/video pending sync.

## Explicitly does NOT own
- Who is allowed to assign a job to whom — that's `survey-workflow`'s `canAssign`/`validAssignmentTargets` logic; this agent only persists the `teams` roster and the `jobs.assignedTo`/`assignmentHistory` fields it's told to write.
- Camera/markup UI → `photo-media`.
- Backend API implementation — integration contract only.

## Requirement anchors
Release 1 §29, §27 (as before, extended by the hierarchy update above). Secondary FR-19.1–19.3, FR-2.5 (return/assignment history, now covering the two-step chain).

## Working rules
1. No feature ships that assumes network availability at the moment of user action.
2. The sync queue preserves operation order per survey session.
3. Any shape change requested by `survey-workflow` (including this hierarchy update) requires a corresponding Dexie schema migration here, coordinated through the Lead Agent.
4. "Installable" (PWA) remains a hard requirement.
