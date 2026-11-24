---
name: survey-runbook-state
description: Use when working on the guided runbook, progress indicator, next-step logic, floor generation, or survey session state. Steps are derived from live state, never hard-coded.
---

# Survey runbook (state-derived)

## Phases → steps
1 Arrive & set up: `whs`, `bfd-wizard` · 2 Survey: `external-network`, `bfd-poc`, `risers`, `floor:<code>…`, `eup`, `common-areas`, `floor-plans` · 3 Design pack: `design-inputs` (`bom` = Phase 1B, flagged off) · `validation` · 4 Hand-over: `surveyor-signoff`, `submit` (`building-manager` = Phase 1B).

## Derivation
```ts
type StepStatus = 'done' | 'current' | 'todo' | 'blocked';
export const selectRunbook = createSelector(
  [selectSession, selectFloors, selectChecklist, selectPlans, selectFlags],
  (s, floors, items, plans, flags): Step[] => {
    const steps = buildStepDefs(floors, flags);        // floors expand to one step each
    return steps.map(def => ({ ...def, status: def.isDone({ s, items, plans }) ? 'done' : 'todo' }))
                .map(markFirstTodoAsCurrent);
  });
export const selectNextAction = createSelector(selectRunbook, r => r.find(x => x.status === 'current'));
export const selectProgress = createSelector(selectRunbook, r => Math.round(100 * r.filter(x => x.status==='done').length / r.length));
```
- `isDone` is a pure function of persisted survey state (e.g. all Mandatory items confirmed + section notes + section confirmed).
- Auto-derived item statuses: "floor plan captured & calibrated" and "floor plan reviewed" come from plan state, not toggles (FR-5.6).
- Completing a sub-flow navigates back to the runbook (single status surface).

## Floors
`generateFloors({basements, above})` ⇒ `[{code:'B2',name:'Basement 2'},{code:'B1'},{code:'GF'},{code:'L1'},…]`. Renaming changes `name` only; `code` is stable. Changing counts after capture: add new floors; removing a floor with data requires explicit confirm and keeps data archived.

## Do / Don't
- Do memoize selectors; do read hydrated state only after `hydrationStatus==='ready'`.
- Don't store `stepDone` booleans; don't hard-code step order in components.
