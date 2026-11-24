# Agentic Workflow

## 1. How to start a task
1. Open Copilot chat with `@Agent` (root).
2. State the goal and FR refs (or ask the root to find them in `requirement-traceability.md`).
3. Root replies with a **brief**: primary agent, secondary agents, hard rules in play, files, acceptance checks.
4. Primary agent implements; secondary agents handle their slice; `testing-qa` closes.

## 2. Brief template
```
Goal:
FR refs:
Primary agent:           Secondary agents:
Hard rules in play:      (H1…H8)
Files likely touched:
Acceptance checks:
Out of scope:
```

## 3. Feature recipes
**New checklist item with photo + measurement**
survey-workflow (config JSON, rule, advisory) → capture-media (photo slot behaviour if new) → offline-data (field persistence ⇒ repo, hydrator, schema bump if indexed) → ui-design-system (only if new component) → testing-qa.

**New screen**
survey-workflow (route, selectors, validation hook) → ui-design-system (layout at 360/768, tokens) → offline-data (data access) → testing-qa (component + e2e + axe).

**New Dexie table or index**
offline-data (type, schema version, repo, hydrator, registry, schema test, rehydration test) → consumers updated → testing-qa.

**New API endpoint**
offline-data (RTK Query endpoint, write-through, MSW mock, types) → consumer feature → testing-qa.

**Canvas/plan feature**
capture-media (model + geometry + persistence) → offline-data (tables/hydration) → ui-design-system (toolbar, tokens) → testing-qa (math + reload).

## 4. Release 1 delivery sequence (suggested)
1. **Foundation:** tokens, AppShell, auth/roles/guards, Dexie schema v1, repos/hydration registry, store, RTK Query base, SyncStatusBadge, MSW. 
2. **Manager:** dashboard, job list/create, site details + floor generation, assign.
3. **Surveyor shell:** My Jobs, Job Overview + map, runbook (state-derived), progress.
4. **Checklist core:** WHS, checklist engine, groups (external, BFD/POC, risers, EUP, common), notes + confirmations.
5. **Capture:** photo capture + markup, per-floor survey.
6. **Plans:** upload, calibration, equipment, routes, photo pins.
7. **Close-out:** design inputs, BFD wizard framework, validation, sign-off, submit, sync worker.
8. **Review:** manager approve/return; returned → rework loop.
9. **Hardening:** offline e2e, performance on mid-range device, a11y, PWA install.
Phase 1B backlog: BoM + SoW, BM sign-off, PDF work pack, full BFD rules, placement compliance.

## 5. Pull-request gate
Copilot PR template includes: FR refs; hydrator registered (H1); schema bumped + test (H2); no literals (H3); no raw fetch (H4); offline path tested; screenshots 360/768/1024.

## 6. Escalation
- Requirement ambiguity or conflict between source docs ⇒ root logs in traceability "Open Conflicts" and asks the product owner; Outcomes doc wins until answered.
- Rule violation found by `testing-qa` ⇒ returned to the owner agent with the failing test.
- Never "solve" a hard-rule conflict by weakening the rule; propose a change to `Agent.md` instead.

## 7. Maintaining the agents
Update an agent/skill file in the same PR that changes the practice it describes. Review all agent files at the end of each sprint; delete guidance that no longer matches the code.
