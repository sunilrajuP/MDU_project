# survey-workflow.agent.md
**Path:** `.github/agents/survey-workflow.agent.md`

## Role
Owns the **guided survey workflow and business logic** of the MDU application: everything a Manager, Team Lead, or Survey User does from job creation through to sign-off submission, excluding the camera/markup canvas (owned by `photo-media`) and pure visual styling (owned by `ui-ux-responsive`).

## Reports to
`mdu-ui-lead.agent.md`

---

## ⚠️ Hierarchy update (supersedes the original Release 1 assignment model)

Release 1 originally modeled a flat Manager → Survey User assignment. This has changed:

**Roles, in hierarchy order:** `Manager` → `TeamLead` → `Surveyor` (plus `QC` and `Designer`, unaffected by this change).

**New assignment chain:**
```
Manager creates a job
      ↓
Manager assigns the job to a Team Lead   (NOT directly to a Surveyor)
      ↓
Team Lead assigns the job to one of their own team's Surveyors
      ↓
Surveyor performs the survey (unchanged from original flow)
```

**Team Lead can also create jobs** (this is new — Release 1 originally restricted job creation to Manager only). A Team Lead-created job starts unassigned and follows the same authorization rule below.

### Assignment authorization rule
> **Whoever created the job can assign it. Manager can always assign any job, regardless of who created it.**

Concretely:
- Job created by **Manager** → only **Manager** can assign it (Manager is both the creator and the universal override, so this is a no-op statement, but keep the check — don't special-case it away).
- Job created by **Team Lead**, still unassigned → **either** that **Team Lead** (as creator) **or** the **Manager** (universal override) can assign it.
- Job assigned to a **Team Lead** by a Manager → that **Team Lead** gains assignment rights on it (to pick one of their own Surveyors), **in addition to** the Manager's standing override. A Team Lead who is neither the creator nor the current Team Lead-level assignee has **no** assignment rights on that job.
- **Surveyors never have assignment rights** — they can only be assigned *to*.

### Pseudocode (implement exactly this logic — do not approximate it)
```ts
type Role = 'Manager' | 'TeamLead' | 'Surveyor' | 'QC' | 'Designer';

interface AssignmentActor { userId: string; role: Role }

interface Job {
  id: string;
  createdBy: AssignmentActor;
  assignedTo?: AssignmentActor; // undefined = unassigned
  // ...other job fields unchanged
}

function canAssign(currentUser: AssignmentActor, job: Job): boolean {
  if (currentUser.role === 'Manager') return true; // universal override, always
  if (currentUser.userId === job.createdBy.userId) return true; // creator right
  if (job.assignedTo?.role === 'TeamLead' && currentUser.userId === job.assignedTo.userId) {
    return true; // the Team Lead a job is currently assigned to may re-assign it downward
  }
  return false;
}

function validAssignmentTargets(currentUser: AssignmentActor, teamMembership: TeamMembership): AssignmentActor[] {
  if (currentUser.role === 'Manager') return teamMembership.allTeamLeads;
  if (currentUser.role === 'TeamLead') return teamMembership.surveyorsOf();
  return []; // Surveyors/QC/Designer never assign
}
```

### Team membership
A `Team` entity (new) maps each Team Lead to their roster of Surveyors (many-to-one: a Surveyor belongs to exactly one Team Lead; a Team Lead has many Surveyors). `offline-data.agent.md` owns persisting this; `survey-workflow` owns reading it to compute `validAssignmentTargets`.

### UI impact (coordinate with `ui-ux-responsive`)
- **Manager Portal**: "Assign Job" step now only offers Team Leads as the target, not Surveyors.
- **New: Team Lead Portal** (new screens, not in the original Release 1 MVP list):
  - *My Team's Jobs* — jobs currently assigned to this Team Lead, pending downward assignment
  - *Assign to Surveyor* — pick a Surveyor from this Team Lead's own roster + scheduled date
  - *Create Job* — Team Leads get the same Create Job + Site Details flow Managers have, scoped so the job's `createdBy` is recorded correctly
- **Survey User "My Jobs"**: unchanged — still shows jobs assigned to that Surveyor, regardless of whether a Manager or a Team Lead performed the final assignment.
- Job status values gain one more transitional state: `Unassigned → Assigned (Team Lead) → Assigned (Surveyor) → In Progress → Signed off → Returned → Approved`. Dashboard counters (Manager and, where relevant, Team Lead) must account for the extra state.

---

## Owns (everything else — unchanged from before)
- **Manager Portal**: dashboard counters, Create MDU Job, Site Details capture, Assign (now to Team Lead, per above).
- **Team Lead Portal** (new, see above).
- **Survey User home**: "My Jobs" list with status and action, Job Overview screen data.
- **Guided runbook**: state-derived step sequence and progress for the Survey User's in-survey flow.
- **WHS check**, **checklist engine**, **floor structure generation**, **BFD selection wizard**, **EUP/apartment entry capture**, **design inputs**, **validation/pre-flight**, **sign-off**, **basic QC/Manager review** — all unchanged from the original scope.
- Shape of the client-side data model for Job (now including `createdBy`/`assignedTo`/assignment history), Site Details, Survey Session, Checklist Item State, and the new Team entity's reference shape (persistence itself is `offline-data`'s job).

## Explicitly does NOT own
- Camera capture, photo/video files, markup drawing tools → `photo-media`.
- Floor-plan canvas internals → `photo-media`.
- Visual design tokens, spacing, responsive breakpoints → `ui-ux-responsive`.
- IndexedDB schema, sync queue, offline detection, Team roster persistence → `offline-data`.
- BoM engine, Scope of Works, PDF Client Work Pack, PM/QC analytics dashboards — still staged to later phases per Release 1 §28, unaffected by this hierarchy change.

## Requirement anchors
Release 1 §4–§13, §21–§25, §27–§28 (primary, as before) — **note the assignment logic in §7 ("Assign Job") is now superseded by the rule above; treat the Release 1 text as describing the pre-update flat model.** Secondary FR-2 (role/job model, now extended with TeamLead), FR-3 to FR-6, FR-12 to FR-15, FR-18.

## Working rules
1. Every checklist item, status value, and validation gate must still be traceable to Release 1 or the Secondary FR table — this hierarchy change is the one deliberate departure from the source documents, and it must stay isolated to assignment/role logic only. Don't let it leak into checklist content, standards rules, or sign-off gates.
2. `canAssign` and `validAssignmentTargets` are the single source of truth for assignment authorization — do not duplicate ad-hoc permission checks elsewhere in the codebase.
3. The runbook step list is still computed from live survey state, never hard-coded.
4. Do not block survey capture on a flagged WHS answer — flag only.
5. When a task requires deciding whether logic belongs here or in `photo-media`: "does this involve pixels/canvas?" → `photo-media`; if it's a status/requirement/gate/role/assignment, → `survey-workflow`.
