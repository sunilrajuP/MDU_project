# Requirement Traceability

Sources: **[O]** = *MDU Survey Tool Requirement Outcomes* (priority, Release 1 scope) · **[R]** = *High-Level Requirements Summary* (FR-n.m). Status: R1 = Release 1 build · 1B = Phase 1B · F = Future/arch-ready only.

## Matrix
| Req | Summary | Source | Release | Agent (primary) | Skills | Key tests |
|---|---|---|---|---|---|---|
| FR-1.1/1.2 | Role sign-in, RBAC | O§4,8 R | R1 | survey-workflow | — | role guard e2e |
| FR-1.3/1.4 | SSO/MFA, multi-tenancy | R | F | survey-workflow | — | — (arch-ready) |
| FR-2.1/2.2 | Job list, create & assign (reassignment in edit screen) | O§5,7 | R1 | survey-workflow | — | manager e2e |
| FR-2.3 | Site details | O§6 | R1 | survey-workflow | checklist-engine | form + hydration |
| FR-2.4 | Floors derived; stable codes | O§6,16 | R1 | survey-workflow | survey-runbook-state | generateFloors unit |
| FR-2.5 | Attempts & return history | R | R1 (basic) | offline-data | dexie-schema-versioning | history persisted |
| FR-3.x | WHS (non-blocking flags) | O§11 | R1 | survey-workflow | checklist-engine | flag doesn't block |
| FR-4.x | Guided runbook, state-derived | O§10 | R1 | survey-workflow | survey-runbook-state | selector tests (H7) |
| FR-5.1–5.4 | Checklist groups, categories, limits | O§12–21 | R1 | survey-workflow | checklist-engine | advisories |
| FR-5.5/5.8 | Standard refs, exemplars | R | 1B/Could | survey-workflow | checklist-engine | — |
| FR-5.6/5.7 | Derived statuses, notes+confirm | R | R1 | survey-workflow | checklist-engine, validation-gates | confirm flow |
| FR-6.x | BFD wizard | O§13, 28 | Framework R1 / rules 1B | survey-workflow | checklist-engine | decision-tree unit |
| FR-7.1–7.2 | Photo capture + markup, original kept | O§14,15 | R1 | capture-media | photo-capture-markup | hash test (H5) |
| FR-7.3/7.4 | Line styles, undo, tag burn | R | R1 (Should) | capture-media | photo-capture-markup | undo/redo |
| FR-7.5 | Photo quality | R | Could | capture-media | photo-capture-markup | — |
| FR-8.x | Video evidence | R | 1B | capture-media | photo-capture-markup | caps |
| FR-9.1–9.4 | Plan upload, calibrate, equipment, dimensions | O§17–19 | R1 (basic equipment 1B-ish) | capture-media | floor-plan-calibration | calibration math, reload (H6) |
| FR-9.5/9.6 | Photo pins, >20 m advisory | O§20 R | R1 | capture-media | floor-plan-calibration | advisory |
| FR-10.x | Placement compliance | R | 1B | survey-workflow | checklist-engine | — (data reserved) |
| FR-11.x | BoM + Scope of Works | O§28 | 1B | survey-workflow | validation-gates | — (tables reserved) |
| FR-12.1 | Design inputs | O§22 | R1 | survey-workflow | checklist-engine | persist |
| FR-13.x | Pre-flight validation, deep links | O§22,23 | R1 | survey-workflow | validation-gates | blocker rules |
| FR-14.x | Building Manager review/sign | O§28 | 1B | survey-workflow | — | — |
| FR-15.1–15.3 | Sign-off gates, lock, tracker | O§24 | R1 | survey-workflow | validation-gates | lock read-only |
| FR-16.x | Client Work Pack / PDF | O§28 | 1B | survey-workflow | — | — |
| FR-17.x | PM field-ops dashboard | O§4 R | R1 (counters) / rest F | survey-workflow | — | counters |
| FR-18.1 | QC approve/return with reason | O§25 | R1 (basic review) | survey-workflow | — | return loop e2e |
| FR-18.2 | QC analytics | R | F | — | — | — |
| FR-19.1–19.3 | Offline capture, sync, no loss | O§29 R | R1 (Must) | offline-data | dexie-*, offline-sync-queue | H1/H8 tests |
| NFR Platform | Mobile-first, installable | R§8 | R1 | ui-design-system | responsive-layout | viewport e2e |
| NFR Maintainability | Rules/checklist as config | R§8 | R1 | survey-workflow | checklist-engine | config schema test |
| NFR Usability/a11y | Guided, legible | R§8 | R1 | ui-design-system | scss-design-tokens | axe |
| NFR Security/residency | Auth, encryption, AU region | R§8 | Backend/infra — out of frontend scope | — | — | Frontend: token handling only |
| Screens 1–31 | MVP screen list | O§30 | R1 | see workflow.md | — | route coverage test |

## Screen coverage (O§30)
Manager 1–9 → `/manager/**`. Survey 10–31 → `/survey/**`. Screens 26 (equipment) and 27 (map/route markup) ship basic in R1; the BFD wizard (part of 17/28) ships as framework.

## Open Conflicts / Clarifications
1. **BoM/SoW timing:** [R] marks BoM *Must*; [O] puts it in Phase 1B. → Following [O]; tables/types reserved. *Confirm with product owner.*
2. **Job statuses:** [R] = Not started / In progress / Signed off / Returned / Approved; [O] dashboard also lists New / Assigned / Submitted. → Model `status` as an enum covering all, map in one place. *Confirm canonical set.*
3. **QC role:** [O] "basic review" by Manager/QC in R1 vs [R] full QC dashboard. → Basic approve/return only; QC analytics deferred.
4. **Equipment placement:** [O] "✅/Phase 1B". → Build the model + basic placement; compliance checklist in 1B.
5. **Building Manager sign-off:** [O] 1B; [R] Must (FR-14.3). → 1B behind a flag; validation gate excluded in R1.
6. **Quality threshold (95%)** appears in the design-process flow; confirm whether it is an in-app QC metric or process KPI only.
7. **Data residency/SSO/multi-tenancy:** backend concerns; frontend will keep auth pluggable (OIDC-ready) only.
8. **Manager/Team Lead parity (confirmed):** FR-1.1/1.2, FR-2.1/2.2,
   FR-17.x, and FR-18.1 share dashboard, job visibility, create/edit/assign, and
   Approve/Return controls. Only assignment targets differ: Manager uses
   `/api/`; Manager and Team Lead rosters use `/api/users/team`. Backend job scope
   and authorization remain authoritative. Review transitions remain unavailable
   until a backend route is configured. Regression coverage: `tests/role-access.test.tsx`.
9. **Assignment UI:** dashboard cards show a disabled assignee control; assignment
   changes are available only from the job create/edit form. All user-visible
   dates use `DD/MM/YYYY`.
