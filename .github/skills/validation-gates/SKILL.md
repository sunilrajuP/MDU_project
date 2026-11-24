---
name: validation-gates
description: Use when implementing pre-flight validation, sign-off gates, completion percentage, blocker deep links, or advisories.
---

# Validation gates

## Blocker types (FR-13.1, FR-15.1)
`whs-incomplete` · `mandatory-item-missing` · `photo-missing` · `measurement-missing` · `notes-missing` · `section-unconfirmed` · `plan-missing` · `plan-uncalibrated` · `markup-missing` · `bfd-wizard-incomplete` · `compliance-incomplete` · `design-inputs-incomplete` · (`bom-unconfirmed` Phase 1B).

## Shape
```ts
interface Blocker { id: string; type: BlockerType; floorCode?: string; itemCode?: string;
                    message: string; route: string /* deep link */; }
interface Advisory { id: string; message: string; route: string; }
selectBlockers(state): Blocker[]      // pure, memoized
selectAdvisories(state): Advisory[]   // non-blocking
selectCompletion(state): { percent: number; remaining: number }
```
- Each rule is a small pure function in `src/features/validation/rules/`, registered in an array; adding a rule never touches the UI.
- Group by type in the UI; example row: "Level 3 – Floor plan not calibrated → [Fix]" navigates to the exact screen.
- Sign-off button enabled only when `selectBlockers` is empty. Show the live tracker (percentage + blockers) in the shell (FR-15.3).
- WHS flags and advisories never block capture; WHS completion blocks sign-off only.
- On sign-off: set `locked=true` through the repo; UI becomes read-only; submit queues for sync.

## Tests
One test per rule with minimal state; an integration test proving "fix → blocker disappears" and deep link route exists.
