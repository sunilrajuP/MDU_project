# Frontend Architecture

## Stack
React 18 · TypeScript (strict) · Vite · React Router (data routers) · Redux Toolkit · RTK Query · Dexie.js · SCSS + CSS Modules · Vitest/RTL · Playwright · MSW · PWA (Workbox service worker).

## Folder structure
```
src/
  app/                 // bootstrap, router, providers, guards
  api/                 // RTK Query (baseApi, endpoints, real backend calls)
  data/
    db/                // Dexie instance, schema.ts (versions), getDb()
    repos/             // only code touching db tables
    hydration/         // hydrators + registry
    sync/              // outbox, worker, status
  store/               // configureStore, root reducer
  types/               // domain + api types
  config/
    checklist/*.json   // groups & items
    rules/             // standards.ts, bfd-decision.ts
  features/
    auth/ jobs/ site/ runbook/ whs/ checklist/ bfd/ eup/
    photos/ markup/ floorplan/ equipment/ routes/
    validation/ signoff/ review/ dashboard/
  components/ui/       // design-system components
  layouts/             // AppShell, TwoPane, ManagerLayout
  lib/                 // geometry, canvas, media, dates
  styles/              // tokens, mixins, global
  test-utils/
```

## Layers & dependency direction
`components/ui` ← `features` ← `store/api/data`. Features never import from other features' internals; share through `types`, `selectors` exports, or `lib`. `components/ui` imports nothing from features.

## Routing (role-based)
```
/login
/manager            dashboard · jobs · jobs/new · jobs/:id · jobs/:id/site · jobs/:id/assign · review/:jobId
/survey             my-jobs · :jobId (overview+map) · :jobId/run (runbook)
  :jobId/whs · /external · /bfd · /risers · /floor/:code · /eup · /common
  :jobId/photo/:itemCode · /markup/:photoId · /plan/:sheetId · /calibrate/:sheetId
  :jobId/design-inputs · /validation · /signoff · /submit
/qc  /designer      guarded placeholders (later release)
```
Guards read role from the hydrated session; unauthorised ⇒ redirect to role home. Job routes use loaders that run `runHydrators('job')`.

## State management
- Slices per feature hold **normalized** entities + `hydrationStatus`.
- Selectors (memoized) compute runbook, validation, completion, advisories.
- RTK Query cache holds server responses only; domain truth for offline lives in Dexie → Redux.
- Blobs never in Redux.

## Site address search and job creation
Address autocomplete uses RTK Query to search Photon after 300 ms without typing
(minimum three characters), cancelling obsolete requests. Photon coordinates are
`[longitude, latitude]`; a selected address supplies `latitude` and `longitude` to
`/api/job/create_job`. These optional fields persist with the local job and outbox
through reload and sync. Editing the address text clears the selection's coordinates;
manual entry remains supported and omits coordinates.

## Offline / PWA
Service worker precaches the shell and static assets; runtime cache for map tiles (best-effort) and reference config. "Download job for offline" action pre-fetches job + site + plans into Dexie before the surveyor leaves coverage. Map falls back to a static placeholder + GPS coordinates when tiles are unavailable.

## Styling
Single token source (`styles/tokens`) emitting CSS custom properties + SCSS maps. CSS Modules per component. Breakpoints: base/tablet/desktop. Brand seed: gradient `#4b3ace → #ffffff` for login; light/white inner screens with purple accents.

## Performance
Route-level code splitting (canvas editors lazy), image downscale + thumbnails, virtualised long lists (floors/EUPs), memoized selectors, `OffscreenCanvas` where supported.

## Security (frontend)
Token handling via RTK Query `prepareHeaders`; no secrets in bundle; role checks in UI are convenience only — server remains the authority; sanitize rendered notes; clear local data policy on logout (confirm if un-synced data exists).

## Accessibility
AA contrast, focus-visible rings, labelled controls, non-colour status cues, reduced-motion support.
