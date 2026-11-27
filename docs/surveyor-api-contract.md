# Surveyor API contract (DRAFT v0.1, for backend review)

## Active survey answer save (backend coordination required)

When online, Start and Continue call `POST /api/jobs/{jobId}/survey-start` with the numeric job ID as the
JSON body, then load `GET /api/jobs/{jobId}/survey`. The survey response may identify its
session with either a numeric ID or a string ID; the client normalizes it to a string.

The active runbook sends `PUT /api/jobs/{jobId}/survey-sessions/{sessionId}/sections/{sectionId}/answers`
with a JSON array containing only the section identified in the path, for example:

```json
[
  {
    "sectionId": 1,
    "answers": [
      { "itemId": 1, "value": "true", "isFlagged": false, "note": "" },
      { "itemId": 2, "value": "", "isFlagged": false, "note": "" },
      { "itemId": 3, "value": "N/A", "isFlagged": false, "note": "Not applicable at this site" }
    ]
  }
]
```

The array includes every supported text or Yes/No/N/A question in that section, including unanswered
questions sent with an empty `value`. Photo and repeat-per-floor answers are not yet supported by
this runbook. The same format is used for autosave and retry. The backend must accept the array,
save the included answers, and return the full survey with the sent values confirmed (an empty
value may be returned as `null`). Failed or unconfirmed answers remain on the device for retry.

If the server returns a different survey session, the current survey is loaded and unsynced
answers from the previous session are discarded. Answers from the same session remain pending.

Status: the Surveyor UI is built against mock data behind `VITE_USE_MOCK_SURVEYOR_API=true`. The UI only uses RTK Query hooks, so swapping to these endpoints needs no UI change. This draft covers the pre-runbook screens, the runbook shell, WHS, BFD, External, Internal Network, floor plans, photo/video and sign-off. Question catalogues for WHS, External Network, NBN Design Inputs and BoM are delivered via the config endpoint (section 3), so the backend owns them.

Open items are marked **[TBC]**. Where a field is inferred from a screenshot and not from a spec, it is marked **[inferred]**.

## 0. Conventions

- Base path: `/api/surveyor` (same host and JWT as the existing `/api/auth/*`, `/api/jobs`, `/api/job/*`). Auth: `Authorization: Bearer <accessToken>`; role must be `Surveyor`.
- JSON, camelCase. Timestamps ISO 8601 UTC. Dates `YYYY-MM-DD`.
- `jobRef` (for example `MDU-000021`) is the job identifier in paths, matching the existing manager API's `jobRef`.
- **Offline-first.** The app writes locally first and syncs later, so every mutating call must be idempotent:
  - Client sends `clientRequestId` (UUID) on every write. Replays with the same id return the original result, not an error.
  - Each section/unit/item carries a server `rev` (integer). Writes send `baseRev`. On mismatch the server returns `409` with the current record so the client can merge.
- Error shape (same as the rest of the app):

```json
{ "status": 422, "message": "Validation failed", "errors": { "sdtToNtdDistanceM": ["Required"] } }
```

- Item status enum (per question/item): `missing | required | pending | photo_pending | captured | not_applicable | clear`.
- Step status enum (per runbook section): `completed | current | draft | unconfirmed | needs_attention | locked | not_started`.
- Percentages and "X of 9 complete" are **computed by the client** from section data, so the server does not need to send display text. The server may still return `progress` for reporting.

## 1. Endpoint summary

| # | Method | Path | Purpose | Screen |
|---|---|---|---|---|
| 1 | GET | `/jobs` | Surveyor's assigned jobs (filterable) | My Jobs |
| 2 | GET | `/jobs/{jobRef}` | Job overview, site location, returned reason | Job Overview, Returned view |
| 3 | POST | `/jobs/{jobRef}/site-location/confirm` | Confirm MDU pin / GPS | Map |
| 4 | GET / PUT | `/jobs/{jobRef}/site-info` | Contacts & access | Site Information |
| 5 | POST | `/jobs/{jobRef}/survey/start` | Start or resume the survey, returns runbook | Job Overview "Start Survey" |
| 6 | GET | `/config/runbook` | Section definitions and question catalogues | Runbook (all sections) |
| 7 | GET | `/jobs/{jobRef}/runbook` | Full runbook state | Survey Runbook |
| 8 | PUT | `/jobs/{jobRef}/runbook/sections/{sectionKey}` | Save a section draft (autosave) | WHS, External, NBN, etc. |
| 9 | POST | `/jobs/{jobRef}/runbook/sections/{sectionKey}/confirm` | Confirm a section (server validates mandatory fields) | All sections |
| 10 | GET | `/config/bfd-selector` | BFD wizard steps and decision rules | BFD Selector carousel |
| 11 | POST | `/jobs/{jobRef}/bfd/recommend` | Compute BFD recommendation from 6 answers | BFD Selector, BFD section |
| 12 | PUT | `/jobs/{jobRef}/bfd/selection` | Save the chosen BFD and answers | BFD section |
| 13 | GET | `/config/internal-network` | Floor checklist, unit, basement and building question sets | Internal Network |
| 14 | PUT | `/jobs/{jobRef}/internal-network/floors` | Configure floors (add, rename, remove) | Internal Network "Configure floors" |
| 15 | PUT | `/jobs/{jobRef}/internal-network/building-record` | Save the shared building PoC/BFD record | Internal Network |
| 16 | PUT | `/jobs/{jobRef}/internal-network/floors/{floorCode}/checklist/{itemCode}` | Save one floor-level or basement check | Internal Network |
| 17 | POST | `/jobs/{jobRef}/internal-network/floors/{floorCode}/units` | **Add unit** | Internal Network "+ Add Unit" |
| 18 | PUT | `/jobs/{jobRef}/internal-network/floors/{floorCode}/units/{unitId}/items/{itemCode}` | Save one unit answer | Internal Network |
| 19 | POST | `.../units/{unitId}/complete` | Mark a unit complete | Internal Network |
| 20 | DELETE | `.../units/{unitId}` | Remove a unit (only if the product keeps this action) **[TBC]** | Internal Network |
| 21 | POST | `/jobs/{jobRef}/media` | Upload photo/video original | Photo Capture |
| 22 | PUT | `/jobs/{jobRef}/media/{mediaId}/markup` | Save markup and marked-up copy | Photo Markup Editor |
| 23 | GET | `/jobs/{jobRef}/media/{mediaId}` | Metadata and download URLs | All thumbnails |
| 24 | DELETE | `/jobs/{jobRef}/media/{mediaId}` | Remove media (draft only) | All questions |
| 25 | POST | `/jobs/{jobRef}/floor-plans/{floorCode}/sheets` | Upload a floor-plan sheet | Floor Plans section |
| 26 | PUT | `/jobs/{jobRef}/floor-plans/{floorCode}/sheets/{sheetId}/calibration` | Two-point calibration | Floor Plans, Internal F1 |
| 27 | GET | `/jobs/{jobRef}/bom` | Bill of materials (derived) | BoM Review |
| 28 | POST | `/jobs/{jobRef}/bom/confirm` | Confirm BoM | BoM Review |
| 29 | GET | `/jobs/{jobRef}/bom/export?format=xlsx` | Export BoM | BoM Review "Export .xlsx" |
| 30 | GET | `/jobs/{jobRef}/validation` | Pre-flight validation result | Pre-flight Validation |
| 31 | POST | `/jobs/{jobRef}/signoff` | Surveyor sign-off | Sign-off & Submit |
| 32 | POST | `/jobs/{jobRef}/submit` | Submit survey (job goes to QC) | Sign-off & Submit |
| 33 | POST | `/sync/push` | Batched offline writes | Background sync |
| 34 | GET | `/jobs/{jobRef}/sync/pull?sinceRev=` | Server changes since revision | Background sync |

## 2. Pre-runbook endpoints

### 1. GET `/api/surveyor/jobs?status=in_progress`
Query: `status` optional (`not_started | in_progress | returned | submitted`). Always scoped to the caller.

```json
{
  "assignedTo": { "userId": "17", "name": "Alex Morgan" },
  "jobs": [
    {
      "jobRef": "MDU-000001",
      "siteName": "Block A",
      "address": "12–18 Bourke Street, Melbourne VIC",
      "status": "in_progress",
      "scheduledDate": "2026-10-01",
      "progress": { "percent": 35, "currentStep": "Floor Survey" },
      "sync": { "state": "synced", "lastSyncedAt": "2026-10-01T09:41:00Z" },
      "returned": null
    },
    {
      "jobRef": "MDU-000005",
      "siteName": "Northbank Apartments",
      "address": "560 Flinders Street, Melbourne VIC",
      "status": "returned",
      "scheduledDate": "2026-10-01",
      "progress": null,
      "sync": { "state": "synced", "lastSyncedAt": "2026-10-01T09:41:00Z" },
      "returned": {
        "reason": "Level 3 floor plan needs calibration and BFD front clearance is missing.",
        "returnedAt": "2026-10-01T00:00:00Z",
        "dataRetained": true
      }
    }
  ]
}
```
`sync.state`: `synced | pending | failed`. The client overrides this with its local state while offline.

### 2. GET `/api/surveyor/jobs/{jobRef}`
```json
{
  "jobRef": "MDU-000001",
  "siteName": "Block A",
  "address": "12–18 Bourke Street, Melbourne VIC 3000",
  "status": "in_progress",
  "scheduledDate": "2026-10-01",
  "assignedTo": "Alex Morgan",
  "location": { "latitude": -37.8121, "longitude": 144.9727, "confirmed": false, "accuracyM": 5 },
  "sync": { "state": "synced", "lastSyncedAt": "2026-10-01T09:41:00Z" },
  "returned": null,
  "surveyStarted": true
}
```

### 3. POST `/api/surveyor/jobs/{jobRef}/site-location/confirm`
```json
{ "clientRequestId": "uuid", "latitude": -37.81210, "longitude": 144.97270, "accuracyM": 5, "capturedAt": "2026-10-01T09:30:00Z" }
```
Response `200`: `{ "confirmed": true, "confirmedAt": "2026-10-01T09:30:02Z" }`

### 4. GET / PUT `/api/surveyor/jobs/{jobRef}/site-info`
Fields marked `fromManager` are prefilled at job creation. The UI shows a "from manager" tag and currently lets the surveyor edit them **[TBC: read-only?]**. GET also returns the dropdown options.
```json
{
  "options": { "parking": ["Yes · B1 visitor", "Yes · Street only", "No parking", "Unknown"] },
  "siteInfo": {
  "stakeholder": {
    "role":  { "value": "Building manager", "fromManager": true },
    "name":  { "value": "Ella Brown", "fromManager": true },
    "phone": { "value": "0412 680 144", "fromManager": true },
    "email": { "value": "ella.brown@blocka.com.au" }
  },
  "access": {
    "parking": "Yes · B1 visitor",
    "accessWindow": "09:00–16:00",
    "entryInstructions": { "value": "Bourke Street lobby; sign in with concierge.", "fromManager": true },
    "accessRequirements": "Collect riser key from Ella. Escort to plant room."
  },
  "rev": 3
  }
}
```
PUT sends `{ "clientRequestId", "baseRev", "siteInfo": { "stakeholder": {...}, "access": {...} } }` and returns `{ "rev": 4, "savedAt": "..." }`. The UI requires contact name and phone (phone: at least 8 digits) and a well-formed email when given **[TBC: which fields are mandatory]**.

### 5. POST `/api/surveyor/jobs/{jobRef}/survey/start`
Idempotent: starts the survey (job → `in_progress`) or returns the existing one. Request: `{ "clientRequestId": "uuid" }`. Response: the runbook (see 7).

## 3. Config endpoints (server-owned catalogues)

All questions and floor definitions are data, so new questions or floors need no UI release.

### 6. GET `/api/surveyor/config/runbook`
```json
{
  "version": "2026.10.1",
  "sections": [
    { "key": "whs", "order": 1, "title": "WHS Check", "subtitle": "Safety, access and site hazards." },
    { "key": "bfd", "order": 2, "title": "BFD Selection Wizard", "subtitle": "Six answers · recommended equipment." },
    { "key": "external", "order": 3, "title": "External Network & Site Entry", "subtitle": "Letterboxes, lead-in pit and building entry." },
    { "key": "internal", "order": 4, "title": "Internal Network", "subtitle": "Location, clearances and existing capacity." },
    { "key": "floorPlans", "order": 5, "title": "Floor Plans, Equipment Blocks & Calibration", "subtitle": "Capture plans, calibrate and review equipment." },
    { "key": "nbnDesign", "order": 6, "title": "NBN Design Inputs", "subtitle": "Site details and network design inputs." },
    { "key": "bom", "order": 7, "title": "BoM Review & Confirm", "subtitle": "Review network design and equipment inputs." },
    { "key": "preflight", "order": 8, "title": "Pre-flight Validation", "subtitle": "Resolve outstanding checks and evidence." },
    { "key": "signoff", "order": 9, "title": "Surveyor Sign-off & Submit", "subtitle": "Review, sign off and submit the site survey." }
  ],
  "questionSets": {
    "whs": [
      { "code": "whs.ppe", "label": "PPE confirmed (high-vis, safety boots, hard hat where required)",
        "type": "yesNo", "options": ["yes", "no"], "detailsLabel": "Log location / details", "detailsRequiredWhen": "yes" }
    ],
    "external": [
      { "code": "ext.letterbox", "label": "Letterbox bank photographed (all panels, all units legible)",
        "type": "evidence", "mandatory": true, "blocksSignoff": true,
        "options": ["n/a"], "photo": { "min": 1, "video": true },
        "referenceImageUrl": "https://.../ref/letterbox.jpg", "notesRequired": true,
        "helpText": "Required: all panels and unit numbers must be legible in the evidence." }
    ]
  }
}
```
Question `type`: `yesNo | choice | multiChoice | text | number | evidence | composite`. The WHS and External catalogues are **[TBC]** (the full lists are extracted from Figma in a later step). WHS rule from the design: every question has a "Log location / details" box. External rule: every question needs mandatory "Notes / confirmation" and photo/video.

### 10. GET `/api/surveyor/config/bfd-selector`
Six ordered steps (Figma "BFD Selector / Question 01–06"). Contents **[TBC until those frames are read]**; shape:
```json
{
  "figure": "Figure 4",
  "steps": [
    { "order": 1, "code": "floorsAboveGround", "prompt": "Floors above ground", "type": "number", "min": 0, "max": 99 },
    { "order": 2, "code": "basementLevels", "prompt": "Basement levels", "type": "number" },
    { "order": 3, "code": "gponPremises", "prompt": "GPON end-user premises", "type": "number" },
    { "order": 4, "code": "businessP2p", "prompt": "Potential business (P2P) locations", "type": "numberWithNote" },
    { "order": 5, "code": "fibreTv", "prompt": "Fibre TV required", "type": "yesNo" },
    { "order": 6, "code": "fdtLikely", "prompt": "FDT installation likely", "type": "yesNo" }
  ]
}
```
(The six decision-trail rows seen in the BFD section **[inferred]** mirror the six steps. Confirm against the question frames.)

### 13. GET `/api/surveyor/config/internal-network`
Full item lists are in `docs/internal-network-items.md` (8 unit questions, 18 floor checks, 5 basement checks, 12 building-record items). Shape:
```json
{
  "version": "2026.10.1",
  "unitQuestions": [
    { "code": "unit.identifier", "order": 1, "label": "Unit identifier · Linked floor", "type": "text", "autoFilled": true },
    { "code": "unit.entryPhoto", "order": 2, "label": "Representative entry photo", "type": "evidence", "required": true,
      "photo": { "min": 1, "video": true }, "helpText": "minimum one per floor" },
    { "code": "unit.gpoProximity", "order": 4, "label": "GPO proximity distance + photo", "type": "composite", "required": true,
      "fields": [ { "code": "distanceM", "type": "number", "unit": "m", "max": 3, "maxHint": "within the 3 m limit" } ],
      "photo": { "min": 1, "video": true } },
    { "code": "unit.icdRequired", "order": 8, "label": "ICD required · 20 m threshold", "type": "choice",
      "required": true, "options": ["yes", "no", "perApartment"], "finalAction": "completeUnit" }
  ],
  "floorChecklist": [ { "code": "floor.fireEscapePlan", "order": 1, "label": "Fire escape plan · photo · two-point calibration", "type": "composite" } ],
  "basementChecklist": [ { "code": "bsmt.access", "order": 1, "label": "Basement access · photo", "type": "evidence" } ],
  "buildingRecord": [ { "code": "bldg.bfdType", "order": 3, "label": "BFD type", "type": "choice", "options": ["BUDI-1S", "BUDI-M", "PCD", "Unknown"] } ],
  "appliesTo": { "basementChecklist": "basement" }
}
```
Rules the server must also enforce: floor header count = floor checklist items (+ basement items on basement floors); a unit's evidence is independent (values are never copied between units).

## 4. Runbook

### 7. GET `/api/surveyor/jobs/{jobRef}/runbook`
```json
{
  "jobRef": "MDU-000001",
  "title": "10 Smith St",
  "rev": 42,
  "sections": [
    { "key": "whs", "status": "completed", "completedAt": "2026-10-28T09:12:00Z", "rev": 5,
      "data": { "answers": [ { "code": "whs.ppe", "value": "yes", "details": null } ] } },
    { "key": "external", "status": "current", "rev": 9, "data": { "items": [] } },
    { "key": "internal", "status": "draft", "rev": 12,
      "data": { "floors": [], "buildingRecord": {}, "siteSurveyorNotes": "" } }
  ]
}
```
`sections` holds saved data only. Counts and percentages are derived on the client. The server may include `progress` per section **[optional]**.

### 8. PUT `/api/surveyor/jobs/{jobRef}/runbook/sections/{sectionKey}`
Section draft save, no completion semantics. Example, WHS:
```json
{
  "clientRequestId": "uuid",
  "baseRev": 5,
  "data": {
    "answers": [
      { "code": "whs.confinedSpace", "value": "yes", "details": "Basement plant area — pit access beside PoC. No entry authorised." }
    ]
  }
}
```
Response `200`: `{ "key": "whs", "rev": 6, "status": "draft", "savedAt": "2026-10-28T09:12:03Z" }`

Example, External Network item (note the mandatory notes and attached media):
```json
{
  "clientRequestId": "uuid",
  "baseRev": 9,
  "data": {
    "items": [
      {
        "code": "ext.letterbox",
        "answer": "n/a",
        "notes": "All panels legible, no glare.",
        "mediaIds": ["m-001"],
        "confirmed": true
      }
    ]
  }
}
```

### 9. POST `.../sections/{sectionKey}/confirm`
Request: `{ "clientRequestId": "uuid", "baseRev": 9 }`. `200` returns `{ "status": "completed", "completedAt": "..." }`. `422` returns per-item errors, for example:
```json
{ "status": 422, "message": "Section cannot be confirmed",
  "errors": { "ext.sealing": ["Photo evidence required"], "ext.letterbox.notes": ["Notes / confirmation is required"] } }
```

### 11. POST `/api/surveyor/jobs/{jobRef}/bfd/recommend`
```json
{ "answers": { "floorsAboveGround": 4, "basementLevels": 1, "gponPremises": 22, "businessP2p": { "count": 2, "note": "GF shops" }, "fibreTv": false, "fdtLikely": false } }
```
```json
{
  "figure": "Figure 4",
  "recommendation": {
    "code": "BUDI-1S", "name": "Medium building fibre device",
    "spec": "12F FSL · up to 200 GPON · multiple P2P",
    "rationale": "BUDI-1S — ≥2 potential business customers (Fig 4)"
  }
}
```

### 12. PUT `/api/surveyor/jobs/{jobRef}/bfd/selection`
Request: `{ "clientRequestId": "uuid", "baseRev": 3, "answers": { }, "selectedCode": "BUDI-1S" }`. Response: `{ "selectedCode": "BUDI-1S", "savedAt": "2026-10-28T09:18:00Z", "rev": 4 }`.

## 5. Internal Network (floors and units)

### 14. PUT `/api/surveyor/jobs/{jobRef}/internal-network/floors`
Replaces the floor list. Floors with data cannot be removed without `"archive": true` (data is kept archived). `code` is stable, `name` can change.
```json
{ "clientRequestId": "uuid", "baseRev": 12,
  "floors": [
    { "code": "B1", "name": "Basement 1", "kind": "basement" },
    { "code": "GF", "name": "Ground floor", "kind": "above" },
    { "code": "L1", "name": "Level 1", "kind": "above" }
  ] }
```

### 17. POST `/api/surveyor/jobs/{jobRef}/internal-network/floors/{floorCode}/units` (Add Unit)
```json
{ "clientRequestId": "uuid", "label": "B1-02" }
```
`label` optional; the server defaults to `<floorCode>-<nn>`. Response `201`: the new unit, with the full unanswered question set from config.
```json
{
  "unitId": "u-7f3a",
  "floorCode": "B1",
  "label": "B1-02",
  "status": "draft",
  "items": [
    { "code": "unit.identifier", "status": "captured", "value": "B1-02 · Linked MDU-000001/B1" },
    { "code": "unit.entryPhoto", "status": "missing", "mediaIds": [] }
  ],
  "rev": 1
}
```

### 18. PUT `.../units/{unitId}/items/{itemCode}`
```json
{ "clientRequestId": "uuid", "baseRev": 1,
  "value": { "distanceM": 2.4 }, "mediaIds": [], "confirmed": false }
```
Response: `{ "code": "unit.gpoProximity", "status": "photo_pending", "message": "2.4 m is within the 3 m limit. A GPO proximity photo is still required.", "rev": 2 }`. Status and message are computed by the server, mirroring client validation.

### 19. POST `.../units/{unitId}/complete`
`409`/`422` if required items are missing; `200`: `{ "status": "completed" }`. Completing a unit does **not** complete the floor or the building record.

### 16. PUT `.../floors/{floorCode}/checklist/{itemCode}`
Same body shape as 18. Applies to the floor checklist (`floor.*`) and basement checks (`bsmt.*`; rejected with `422` on non-basement floors). Repeatable items (such as riser locations) send an array:
```json
{ "clientRequestId": "uuid", "baseRev": 4,
  "value": { "risers": [ { "location": "B1 · service corridor", "mediaIds": ["m-014"] } ] } }
```

### 15. PUT `.../internal-network/building-record`
```json
{ "clientRequestId": "uuid", "baseRev": 8,
  "items": [
    { "code": "bldg.bfdType", "value": "BUDI-1S" },
    { "code": "bldg.heightFromFloorMm", "value": 1200 },
    { "code": "bldg.availablePortCapacity", "value": null }
  ],
  "confirmed": false }
```
Internal Network section confirmation (via 9) requires: Site Surveyor Notes non-empty, building record confirmed, every floor checklist complete, and each required unit complete.

## 6. Photo / video

Flow: capture → preview OK → markup editor → attach. The **original is immutable**. Markup produces a separate marked copy plus vector objects for re-editing.

### 21. POST `/api/surveyor/jobs/{jobRef}/media` (`multipart/form-data`)
Parts: `file` (binary), `meta` (JSON):
```json
{ "clientMediaId": "uuid", "kind": "photo", "mimeType": "image/jpeg", "sizeBytes": 2483921,
  "capturedAt": "2026-10-28T09:24:00Z", "capturedBy": "Alex Morgan",
  "context": { "sectionKey": "external", "itemCode": "ext.letterbox", "floorCode": null, "unitId": null },
  "durationSec": null }
```
Response `201`:
```json
{ "mediaId": "m-001", "clientMediaId": "uuid", "kind": "photo", "status": "uploaded",
  "originalUrl": "https://.../media/m-001/original", "thumbUrl": "https://.../media/m-001/thumb",
  "sha256": "…" }
```
Video limits **[TBC]**: max length and size, count per item; photo or video count per item must meet `photo.min` from the config. Large files may use resumable upload **[TBC]**. Re-posting the same `clientMediaId` returns the existing record.

### 22. PUT `/api/surveyor/jobs/{jobRef}/media/{mediaId}/markup` (`multipart/form-data`)
Parts: `markedFile` (rendered image, optional if rendered server-side) and `markup` (JSON):
```json
{ "clientRequestId": "uuid", "purpose": "External conduit sealing condition",
  "note": "Unsealed wall penetration. Confirm suitable sealing treatment.",
  "objects": [
    { "id": "o1", "kind": "arrow", "points": [[0.18, 0.28], [0.38, 0.52]], "style": { "color": "red", "widthPx": 4, "lineStyle": "solid" } },
    { "id": "o2", "kind": "rect",  "points": [[0.46, 0.43], [0.70, 0.66]], "style": { "color": "red", "widthPx": 4, "lineStyle": "solid" } },
    { "id": "o3", "kind": "dimension", "points": [[0.47, 0.72], [0.68, 0.72]], "text": "Ø 50 mm", "style": { "color": "red", "widthPx": 4, "lineStyle": "solid" } },
    { "id": "o4", "kind": "callout", "points": [[0.08, 0.15]], "text": "Seal gap · vermin risk" }
  ] }
```
`kind`: `line | arrow | rect | shape | dimension | callout | text`. Coordinates are normalised 0–1. `lineStyle`: `solid | dashed | dotted | dashDot | phantom`. Response: `{ "mediaId": "m-001", "markedUrl": "https://.../media/m-001/marked", "markupRev": 2 }`. The original file is never modified.

### 23. GET / 24. DELETE `/media/{mediaId}`
GET returns the object from 21 plus `markup` (if any). DELETE returns `204` and is refused with `409` after the survey is submitted.

### 25–26. Floor plans
`POST .../floor-plans/{floorCode}/sheets`: multipart image or PDF plus `{ "label": "Wing A" }` returns `{ "sheetId": "s-1", "fileUrl": "…", "status": "needs_calibration" }`.
`PUT .../sheets/{sheetId}/calibration`:
```json
{ "clientRequestId": "uuid",
  "pointA": { "x": 0.12, "y": 0.40 }, "pointB": { "x": 0.78, "y": 0.41 },
  "realDistanceM": 24.5, "reviewed": false }
```
Response: `{ "scalePxPerM": 31.2, "status": "calibrated" }`. "Plan ready" per floor = captured + calibrated + reviewed.

## 7. Design, BoM, validation, sign-off

### 27. GET `/jobs/{jobRef}/bom`
```json
{ "derivedFrom": ["floorPlans", "dimensions", "nbnDesign"], "confirmed": false, "stale": true,
  "rows": [ { "id": "r1", "item": "Cable tray 300 mm", "unit": "m", "quantity": 12.5, "confirmed": false } ],
  "warnings": ["Plans are still missing; all 15 rows remain unconfirmed. Quantities are not a live calculation."] }
```
**[TBC]**: BoM columns and calculation rules, since only a table header was visible in the screenshot.

### 28. POST `/bom/confirm`
`{ "clientRequestId": "uuid", "rowIds": ["r1"] }`. Any change to upstream data resets confirmation (`confirmed:false`).

### 30. GET `/jobs/{jobRef}/validation`
```json
{ "percentComplete": 22, "canSubmit": false,
  "issues": [ { "sectionKey": "external", "itemCode": "ext.sealing", "severity": "blocking",
                "message": "External sealing evidence is required." } ] }
```

### 31. POST `/signoff`, 32. POST `/submit`
Signoff: `{ "clientRequestId": "uuid", "surveyorName": "Alex Morgan", "declaration": true, "signedAt": "2026-10-28T11:00:00Z", "notes": "" }`. Locked (`423`) until validation has no blocking issues. Submit: `{ "clientRequestId": "uuid", "baseRev": 42 }`. Response: `{ "jobRef": "MDU-000001", "status": "pending_qc", "submittedAt": "…" }`. A signature or declaration format **[TBC]** since the sign-off frame is not yet read.

## 8. Offline sync

Aligned with the types already declared in `src/types/domain.ts` (`SyncPushRequest`, `MediaUploadRequest`).

### 33. POST `/api/surveyor/sync/push`
```json
{ "jobId": "MDU-000001",
  "operations": [
    { "opId": "uuid-1", "entity": "checklistItem", "entityId": "unit.gpoProximity@u-7f3a",
      "method": "PUT", "path": "/jobs/MDU-000001/internal-network/floors/B1/units/u-7f3a/items/unit.gpoProximity",
      "payload": { "value": { "distanceM": 2.4 } }, "clientTimestamp": "2026-10-28T09:30:00Z" }
  ] }
```
Response: `{ "jobId": "MDU-000001", "acceptedOperationIds": ["uuid-1"], "rejected": [], "serverRevision": 43 }`. Rejected operations include `{ "opId", "status", "current" }` for merge. Media uploads go through endpoint 21 directly, not the push queue.

### 34. GET `/jobs/{jobRef}/sync/pull?sinceRev=42`
Returns sections, units and media changed since `sinceRev`, plus the new `serverRevision`.

## 9. Open questions for backend
1. Confirm the `/api/surveyor/...` prefix (existing manager routes use `/api/job/...`, `/api/jobs`).
2. Server-side vs client-side computation of the BFD recommendation (endpoint 11).
3. Video limits and resumable upload.
4. BoM calculation ownership and columns.
5. Whether units can be removed (endpoint 20), and a limit on units per floor.
6. Returned jobs: does a returned job reopen the same runbook revision with returned items flagged? Needs a per-item `returnedReason`.
7. Job id: UI and Figma use mock refs; the real `jobRef` format is `MDU-000021` per the manager API.

## 10. Addendum: Runbook as built (supersedes §11, §12, §27, §31 and §32 where they differ)

The UI is implemented against exactly these shapes (mock handlers in `src/mocks/surveyor/handlers.ts`). Percentages, "X of 9 complete", chips and counts are **derived on the client** from the section data below; the server never needs to send them.

### 10.1 Offline behaviour the backend must support
- Each runbook section is edited locally first (Dexie) and flushed with `PUT /jobs/{jobRef}/runbook/sections/{sectionKey}`, then `POST .../confirm` when the surveyor marks it complete. Replays carry the same `clientRequestId` and must be idempotent.
- On `409` (stale `baseRev`) the client currently keeps the draft and retries; merge rules are a backend decision **[TBC]**.
- The Sign-off `submit` is **never treated as done until the server returns 200**. An offline sign-off is queued on the device and submitted on reconnect.

### 10.2 `POST /jobs/{jobRef}/bfd/recommend`
Request (answers are strings; counts are whole numbers):
```json
{ "answers": { "floorsAboveGround": "4", "basementLevels": "1", "gponPremises": "22", "businessP2p": "2", "businessP2pNote": "GF shops", "fibreTv": "no", "fdtLikely": "no" } }
```
Response:
```json
{ "figure": "Figure 4",
  "recommendation": { "code": "BUDI-1S", "name": "Medium building fibre device", "spec": "12F FSL · up to 200 GPON · multiple P2P", "rationale": "BUDI-1S — ≥2 potential business customers (Fig 4)" } }
```
The six question prompts are **[TBC]** until the BFD Selector frames are read; the answer codes above are the contract.

### 10.3 `GET /jobs/{jobRef}/bom`
```json
{ "stale": true,
  "rows": [
    { "id": "ntd", "item": "NTD", "description": "1 per premises (EUP count, letterbox-confirmed)", "quantity": 22, "unit": "ea", "source": "calculated" },
    { "id": "fittings", "item": "Conduit fittings (bends / joins)", "description": "Estimated by designer", "quantity": 0, "unit": "ea", "source": "manual", "flag": "Missing fittings · Review required" }
  ] }
```
`unit`: `ea | Lm`. `source`: `plan | calculated | manual`. The UI shows 15 rows; the surveyor confirms each row and may override a quantity (stored in the section data, §10.5). `flag` marks a row that needs an explicit review when its quantity is 0.

### 10.4 Sign-off and submit
`POST /jobs/{jobRef}/signoff`: `{ "clientRequestId", "surveyorName": "Alex Morgan", "declaration": true, "signedAt": "2026-10-28T10:42:00Z" }` → `200`.
`POST /jobs/{jobRef}/submit`: `{ "clientRequestId" }` → `{ "jobRef", "status": "submitted", "submittedAt" }`. The UI calls signoff then submit; a failed signoff never reaches submit. After success the job appears as Submitted and every section is read-only.

### 10.5 Section `data` shapes (the `data` field of §8)
All values are JSON; number fields are stored as the raw text the user typed (e.g. `"2.4"`).

| Section key | `data` |
|---|---|
| `whs` | `{ "answers": { "<code>": { "value": "yes\|no\|na", "details": "" } }, "hazardNotes": "", "siteNotes": "", "completedAt": "ISO" }` |
| `bfd` | `{ "answers": { "<stepCode>": "<string>" }, "selection": { "code", "name", "spec", "rationale", "figure", "savedAt" } \| null }` |
| `external` | `{ "items": { "<code>": ItemState }, "siteNotes": "" }` |
| `internal` | `{ "floors": [ { "code": "B1", "name": "Basement 1", "kind": "basement\|above" } ], "building": { "<code>": ItemState }, "buildingConfirmed": false, "byFloor": { "<floorCode>": { "checklist": { "<code>": ItemState }, "basement": { "<code>": ItemState }, "units": [ { "id": "uuid", "label": "B1-01", "completed": false, "items": { "<code>": ItemState } } ], "unitSeq": 2 } }, "siteNotes": "" }` |
| `floorPlans` | `{ "byFloor": { "<floorCode>": { "media": [Attachment], "calibration": { "pointA": [x, y] \| null, "pointB": [x, y] \| null, "distanceM": "10", "imageAspect": 1.5 } \| null, "devices": [ { "id", "type" } ], "notes": "", "reviewed": false, "ready": false } }, "siteNotes": "" }` |
| `nbnDesign` | `{ "site": { "floors", "basement", "eup", "commonAreas", "p2p", "fibreTv", "mduSolution" }, "design": { "fdt", "pitPipe", "cabling", "notes" }, "siteNotes": "" }` (an absent `site` key means "use the value flowed in from other sections") |
| `bom` | `{ "rows": { "<rowId>": { "confirmed": true, "quantity": "14" } } }` |
| `signoff` | `{ "declaration": true, "signedAt": "ISO", "pendingSubmit": false, "submittedAt": "ISO" }` |

`ItemState` = `{ "values": { "<fieldCode>": "text" \| ["multi"] }, "media": [ { "id", "kind": "photo\|video", "capturedAt", "hasMarkup" } ], "confirmed": false, "na": false }`.

Floor `kind: "basement"` identifies basement floors (they get the 5 basement checks). **Unit ids are stable**; `unitSeq` is the highest unit number ever issued on a floor so a removed unit's number (e.g. `B1-02`) is never reused. Removing a floor keeps its `byFloor` entry (archived); re-adding the same code restores it.

### 10.6 Question catalogue
Item codes and labels for WHS (13), External (8) and Internal Network (12 building, 18 floor, 5 basement, 8 unit) live in `src/features/survey/runbook/config/` and `docs/internal-network-items.md`. They are intended to be served by `GET /config/runbook` and `GET /config/internal-network` (§3) so the backend owns them.

