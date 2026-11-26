# Surveyor work: existing files modified

Every file that existed before the Surveyor work and was changed by it. Nothing is committed.

**Reverting:** do not use `git checkout` (other files hold your own uncommitted work). Each file below has a patch containing only my changes in `docs/surveyor-patches/`. Undo one with:

```
git apply -R docs/surveyor-patches/<patch>
```

All six patches are checked with `git apply -R --check`. They were generated from `git diff` of files that had no uncommitted changes of yours when I touched them, so each patch is exactly my edit. If you later edit one of these files yourself, regenerate or hand-edit its patch first.

| File | Patch | Change |
|---|---|---|
| `src/store/index.ts` | `index.ts.patch` | Registered the `surveyorApi` reducer and middleware next to `baseApi`. |
| `src/data/db/schema.ts` | `schema.ts.patch` | Added the `MediaRecord` and `RunbookDraftRecord` types and two additive Dexie versions: `version(3)` adds `media`, `version(4)` adds `runbookDrafts`. Existing tables untouched. |
| `src/app/paths.ts` | `paths.ts.patch` | Added Surveyor path constants (`/survey/...`). Existing constants unchanged. |
| `src/app/router.tsx` | `router.tsx.patch` | Replaced the `SurveyorHome` stub route with `SurveyorLayout` and its child routes (My Jobs, Overview, Map, Site Info, Account), and added a top-level `RunbookPage` route (the runbook has its own header, so it sits outside `SurveyorLayout`). Manager, QC and Designer routes unchanged. |
| `src/components/ui/Input.tsx` | `Input.tsx.patch` | Added an optional `tag` prop (the small "· from manager" label suffix). Backwards compatible. |
| `src/components/ui/Input.module.scss` | `Input.module.scss.patch` | Added the `.tag` style. |

Note: `index.ts.patch` is `src/store/index.ts` (the file name alone is ambiguous).

## Files that already had your uncommitted changes (not touched by me)
`src/api/baseApi.ts`, `AddressAutocomplete.tsx`, `NotificationProvider.module.scss`, `CreateJobPage.tsx`, `JobCard.*`, `StatusFilterBar.*`, `ManagerDashboardPage.*`, `AppShell.*`, `src/styles/_tokens.scss`, `tests/job-card-metadata.test.tsx`. I only read them. `AppShell` is reused unchanged by the Surveyor layout.

## New files (revert by deleting)
- Types / data: `src/types/surveyor.ts`, `src/data/repos/{mediaRepo,runbookRepo}.ts`
- API + mocks: `src/api/surveyor{Api,Transport}.ts`, `src/mocks/surveyor/` (jobs, runbook config, in-memory db, handlers, BFD + BoM, `seedRunbook.ts`)
- Dev only: `src/dev/devNetwork.ts`
- Auth: `src/features/auth/useSignOut.ts`
- UI components: `src/components/ui/{ProgressBar,StatusChip,Callout,ChoiceGroup,Textarea,Modal,Select,ConfirmDialog}.*`
- Features: `src/features/survey/` — `capture/`, `layout/`, `account/`, `jobs/`, `overview/`, `siteinfo/`, `runbook/` (model, config, logic, questions engine, state, shell, 9 section folders)
- Tests: `tests/surveyor-*.test.ts*`, `tests/runbook-helpers.tsx`, `tests/complete-survey.ts`
- Docs: `docs/surveyor-*.md`, `docs/surveyor-patches/`, `docs/internal-network-items.md`, `docs/figma-cache/`

## Left in place but unused
- `src/features/stubs/SurveyorHome.tsx` (no longer routed; left as requested).
