# Agentic Architecture — MDU Fibre Survey App (Frontend)

## 1. Purpose
Define how GitHub Copilot agents are organised to build the Release 1 frontend consistently, and how the hard rules learned from real bugs are enforced by structure, not memory.

## 2. Scope
In: React/TypeScript SPA/PWA, mobile-first + tablet, offline-first, SCSS tokens.
Out: backend, database servers, infra, DevOps. API contracts are assumed and mocked (MSW).

## 3. Agent topology
```
                    ┌──────────────────────┐
                    │  Agent.md (root)     │  route · brief · Definition of Done
                    └─────────┬────────────┘
   ┌───────────┬──────────────┼───────────────┬──────────────┐
   ▼           ▼              ▼               ▼              ▼
survey-     ui-design-    offline-data    capture-media   testing-qa
workflow    system        (Dexie, RTKQ)   (photo, plan)   (all levels)
   │           │              │               │              │
 skills:     skills:        skills:         skills:        skills:
 runbook     scss-tokens    dexie-schema    photo-markup   testing-strategy
 checklist   responsive     dexie-rehydr.   floor-plan
 validation                 rtk-query
                            sync-queue
```
Every change ends at `testing-qa`. Cross-agent work is declared up-front in the root brief (primary + secondary agents).

## 4. Ownership matrix
| Concern | Owner | Consumers |
|---|---|---|
| Types in `src/types` | offline-data | all |
| Dexie schema, repos, hydrators | offline-data | survey-workflow, capture-media |
| RTK Query API layer | offline-data | all (via hooks/selectors) |
| SCSS tokens, UI kit | ui-design-system | all |
| Runbook, checklist, validation | survey-workflow | capture-media, ui |
| Canvas, media, plan model | capture-media | survey-workflow |
| Tests, CI gates | testing-qa | all |

## 5. Hard-rule enforcement map
| Rule | Prevents | Enforced by |
|---|---|---|
| H1 Dexie source of truth + rehydration | Job disappears on refresh | Repo/hydrator registry, meta-test, round-trip tests, PR checklist |
| H2 Schema versioning | Silent indexing errors / job fetch failures | Append-only schema file, index-coverage schema test, upgrade tests |
| H3 One token source | Visual drift, hard-coded values | Stylelint strict-value rule, literal-scan test |
| H4 RTK Query for APIs | Ad-hoc fetch, offline breakage | ESLint restricted globals/imports, outbox pattern |
| H5 Immutable originals | Evidence tampering | Hash test |
| H6 Structured plan data | Loss of BoM-ready data | Persistence tests |
| H7 Derived runbook | Stale progress | Selector tests |
| H8 No lost work | Sync data loss | Failure-injection test, status badge |

## 6. Data flow (offline-first)
```
UI event → thunk → repository.write (Dexie, awaited) → enqueue outbox → dispatch Redux update
App boot / job route → hydration registry → Dexie read → Redux *Hydrated actions → UI ready
Online → sync worker → RTK Query mutations (batch/media) → server → ack rev → mark done
Server data → RTK Query query → onQueryStarted → repository upsert → hydrate → Redux
```
Redux is always rebuildable from Dexie.

## 7. Release 1 boundaries
Build: Manager (login, dashboard, jobs, create, site details, assign, status, basic review approve/return) and Survey User (full guided survey → sign-off → submit); offline design from day one.
Architecture-ready only: QC dashboard/analytics, Designer consumption, BoM, Scope of Works, Building-Manager sign-off, PDF work pack, BFD full rule set, placement-compliance. Feature-flagged steps with reserved tables/types.
Future (not designed here): AI photo/plan extraction, S18 integration, automated design/QA.

## 8. Conventions
- TypeScript strict; feature folders; barrel exports only at feature root.
- Branches `feat/<FR-ref>-<slug>`; PR template includes the Definition of Done.
- Standards numbers live in `src/config/rules/standards.ts` with `reviewedAgainst`.

## 9. Open items
See "Open Conflicts" in `requirement-traceability.md`.
