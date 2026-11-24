# React + TypeScript + Vite

## Authentication expiry and refresh

- Login persists `accessToken`, `refreshToken`, and `expiry` in IndexedDB and
  restores them to Redux on startup. Existing sessions without refresh metadata
  remain readable; they require sign-in again if the backend rejects their token.
- Protected API calls refresh expired tokens before sending, or after a `401`,
  using `POST /api/auth/refresh` with JSON `{ "refreshToken": "..." }` through
  the existing API base URL/proxy. Concurrent failures share one refresh call.
  The original request (including body and idempotency key) is retried at most once.
- The confirmed refresh response is `{ "accessToken": "..." }`. The backend must
  supply a future JWT `exp` claim (seconds since Unix epoch) or an ISO datetime
  `expiry`. An optional rotated `refreshToken` replaces the stored token;
  otherwise the existing refresh token is retained.
- Refresh rejection, network failure, malformed/expired refresh responses, or a
  second `401` clears authentication and API cache and routes to login via the
  existing auth guards. Locally saved jobs and queued work are not deleted.
  An in-flight refresh cannot restore a logged-out session or overwrite a new login.
- Manager and Team Lead sign-out sends `POST /api/auth/logout` with the saved
  refresh token. Local authentication is removed even if revocation fails or
  the token is missing; the login screen warns that the server session could
  not be revoked. Saved jobs and queued work are retained.
- Backend refresh availability, expiry claims, and refresh-token rotation still
  need verification against the deployed backend; this workspace is frontend-only.

## Manager and Team Lead access

- Both roles use the same dashboard, job visibility, create/edit/assign controls,
  and Approve/Return actions. Locked-job rules still apply. The backend remains
  authoritative for authorization and which jobs its list endpoint returns.
- Managers assign to Team Leads and Team Leads assign to Surveyors using the
  authenticated user's roster from `/api/user/team`. This applies to new jobs
  and reassignments.
- Team Lead assignments and Surveyor assignments are separate: `assigneeTeamLead`
  identifies the lead when present (`assigneeName` remains supported as a legacy
  field), and `latestSurveyorName` identifies the surveyor. When a list response
  omits the lead, visible cards request job details without requiring navigation.
  Detail responses do not replace a known lead with an ambiguous surveyor name. Team Lead
  create/edit/reassign controls change the surveyor without replacing the lead.
  Their edit dropdown shows the current surveyor or **Unassigned**. For Team Lead
  views, an unassigned surveyor displays **Yet to Assign** and an assigned surveyor
  displays **Not Started**, without replacing later workflow statuses.
- Login accepts `TEAM_LEAD`, `TEAMLEAD`, and `Team Lead` as the `TeamLead` role,
  including array-valued role claims. The session is persisted before dashboard
  requests start.
- Review controls have parity, but saving review decisions still requires a
  backend transition route; the existing unconfigured endpoint reports an error.

## Editing existing jobs

- The Manager and Team Lead dashboard shows 15 jobs per page, with three cards
  per row on desktop (1024px+), two on tablet (768px+), and one on mobile.
  The desktop dashboard fills the available content width and height: cards
  expand with the window, with fluid padding and typography on larger screens.
  Other screens retain their existing content width limits.
  Long site names and addresses are ellipsized on desktop
  with full text available on hover and in job details. Tablet and mobile retain
  vertical scrolling; unusually long metadata or increased text zoom can also
  require scrolling on desktop rather than clipping content.

- Use the pencil at the top-right of an editable job card to open the existing
  Create Job form in edit mode. Site name, address, scheduled date, comments, and
  current assignment are prefilled.
- **Save Changes** updates the same job; **Cancel** returns without saving.
  **Reassign job** can keep the current assignment, select an eligible team member
  (Manager → Team Lead; Team Lead → Surveyor), or unassign the job.
- Submitted, pending-QC, and approved jobs cannot be edited or reassigned.
  Existing assignment permissions also apply to editing and direct edit URLs.
- Updates use `PUT /api/job/update_job/{jobId}` with `siteName`,
  `siteAddress`, `scheduledDate`, `comments`, `updatedDate`, and
  `assignedSurveyorId` (the current or newly selected ID, or `null` to unassign).
  If a job only has the assignee's name, the current active roster is used to
  resolve a unique matching ID. If no match or multiple matches are found, an
  explicit selection is required to avoid changing the wrong assignment.
- Creation sends `createdDate` as a date-only ISO value (`YYYY-MM-DD`). Saving the Edit Job form
  sends `updatedDate` without replacing the original creation date. Dates reflect
  the original save date, not the later sync date; offline edits before creation
  sync include both date-only values in the creation payload. The API strips time
  from these fields without timezone conversion, including queued retries.
  Internal save/sync timestamps remain unchanged.
- Cards show **Created Job** below the scheduled date, switching to **Updated Job**
  after an Edit Job save. Assignment-only changes do not switch this label.
  The backend should persist and return `createdDate` and `updatedDate` on create,
  update, list, and detail responses so dates are available on other devices.
  Cached dates survive omitted response fields and reloads; legacy jobs without
  either timestamp show **Created Job: Not available** rather than a guessed date.
- Creation also sends `createdBy` as the signed-in user's display name, captured
  when the job is created. Cards show **Created by** below the date; editing or
  reassigning the job does not replace the original creator. The dashboard uses
  `createdByName` returned by the backend on create, list, and detail responses,
  preferring it over the locally captured name. The backend should validate the
  creator against the authenticated user. Internally, `createdByName` stores this name
  separately from the existing `createdBy` user ID/role used for sync ownership.
  Cached names survive omitted response fields and reloads. Legacy jobs without
  a known creator name show **Created by: Not available**.
- Visible cards automatically fetch `GET /api/job/{jobId}` when the list and local
  cache lack a creation date or creator name. Metadata is persisted and displayed
  without opening job details. Cards show a loading state during this request,
  **Unable to load** on failure, and **Not available** only if the detail response
  also omits the metadata. Complete cached metadata does not trigger extra requests.
- Job details use `GET /api/job/{jobId}`, survey sessions use
  `GET /api/{jobId}/survey`, and assignment-only changes use
  `PATCH /api/jobs/{jobId}/reassign`.
- Managers and Team Leads must be online to create or edit a job. The app
  saves the server-confirmed job to IndexedDB for offline viewing. If the
  server cannot be reached, the form keeps its input for a manual retry and
  does not add a job or edit to the sync queue.
- The separate Reassign action still supports offline saves. The app also
  retains queued creates and edits from older versions so they can sync.
- Queue sync runs after offline-capable saves, app startup, reconnection, and returning to the app
  while it is open (or on its next launch if it was closed).
  Network/server failures retry with 2s/10s/60s backoff. Validation/authorization
  errors require correction. The header shows pending jobs and
  actionable errors; failed jobs remain saved across reloads. Only the signed-in
  user's queued writes are replayed. Server list refreshes preserve unsynced edits.
- Creation uses the existing `POST /api/job/create_job` route and reuses the
  `Idempotency-Key` when retrying unchanged input in the same form. **The backend
  must honor that header** (store and replay the response per user/key) to prevent
  duplicates if a response is lost after the server commits. This workspace has
  no backend implementation, so that server-side guarantee must be verified there.
- Building-detail updates still require a configured backend route; they remain
  local with an explicit sync error rather than being silently discarded.
- The list response may optionally include `comments` and `assignedSurveyorId`.
  When omitted, cached values are retained. Comments never returned by the
  server and not already cached cannot be reconstructed on another device.
- Manager job status badges use the status returned by `/api/jobs`. `NotStarted` maps
  to the existing internal `assigned_surveyor` state and displays **Not Started**,
  rather than falling back to a cached status or **Yet to Assign**.

Run `npm test` for component and Dexie integration regression tests covering
editing, reassignment, unassignment, permissions, failed sync, and rehydration.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
