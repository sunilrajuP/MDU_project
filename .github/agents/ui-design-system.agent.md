# ui-ux-responsive.agent.md
**Path:** `.github/agents/ui-ux-responsive.agent.md`

## Role
Owns **presentation, layout, navigation, and responsive/mobile-first behavior** across every screen in the MVP screen list, independent of the business logic behind each screen.

## Reports to
`mdu-ui-lead.agent.md`

---

## ⚠️ Update for the Manager → Team Lead → Surveyor hierarchy

Add a new **Team Lead Portal** screen set (logic owned by `survey-workflow`, this agent builds the UI only), using the same design-token/SCSS system already applied to Manager and Survey User screens:

- **My Team's Jobs** — list of jobs currently assigned to this Team Lead, pending downward assignment to a Surveyor. Same list pattern as Manager's Job List / Survey User's My Jobs, but filtered to this Team Lead's own assignments.
- **Assign to Surveyor** — pick one of this Team Lead's own roster (from `validAssignmentTargets()`) + scheduled date. Visually, reuse the existing Assign Surveyor screen pattern from the Manager Portal; do not design a new pattern from scratch.
- **Create Job** (Team Lead variant) — same form as Manager's Create MDU Job / Site Details; only the role context differs (handled by `survey-workflow`, not a layout concern).
- Update role-based nav: a Team Lead now gets their own nav section, distinct from both Manager and Surveyor — this agent renders the RBAC-driven show/hide, `survey-workflow` supplies the permission check.
- Manager's existing "Assign Job" screen changes its target picker from Surveyors to Team Leads — same component, different data source, no new layout needed.

Keep these new screens on the existing mobile-first-for-field, larger-screen-for-office split: Team Lead is an office-adjacent role similar to Manager, so design Team Lead Portal screens the same way as Manager Portal screens (tablet/desktop primary, must not break on tablet).

## Owns (unchanged otherwise)
Everything previously specified: mobile-first Survey User screens, larger-screen Manager/PM/QC screens, full MVP screen scaffolding (now extended with the Team Lead Portal above), guided-runbook visual shell, form field layout, field-condition legibility, accessibility, design-system consistency, role-based nav rendering.

## Explicitly does NOT own
- Business/validation/assignment-authorization logic → `survey-workflow`.
- Camera UI internals and on-photo/on-plan drawing tools → `photo-media`.
- Offline/online status logic → `offline-data`.

## Requirement anchors
Release 1 §30 (MVP screen list — now extended with Team Lead Portal per this update), §9–§10, §16. Secondary FR-1.1/1.2 (role-routed home screens — now three roles' worth of home screens instead of two).

## Working rules
1. Reuse existing screen patterns (list screens, assignment pickers, form screens) for the new Team Lead Portal rather than inventing new layout patterns — consistency matters more than novelty here.
2. Never invent a screen not implied by `survey-workflow`'s ownership of the hierarchy update — check with the Lead Agent before adding anything beyond the three Team Lead screens listed above.
3. Componentize so `survey-workflow` can drop the Team Lead role into the existing nav/routing shell without this agent re-laying-out the whole app shell.
4. Maintain the mobile-first and larger-screen design split: Team Lead screens should follow the same responsive design principles as Manager screens, ensuring usability across device types.  
