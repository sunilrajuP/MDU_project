# Surveyor backlog

Items deliberately deferred. Nothing here blocks the main screens.

## Capture / markup (parked by request, refine in detail later)
- [ ] **Photo Capture frame match.** Frame `556:25413` was never read (Figma call limit). The capture and preview steps use a generic layout and must be aligned to the design once the frame is fetched.
- [ ] **Tap-to-select / move / reshape / recolour** for markup objects. Today Delete removes the last-drawn object only; recolour applies to new objects only. (`.github/skills/photo-capture-markup` lists these.)
- [ ] **Offline retry queue for uploads.** Media and markup uploads fire once and stay `pending` on failure. Needs a Dexie-backed queue (like `syncQueue`) with backoff, plus a `failed` state and manual retry.
- [ ] **Video limits.** Code caps clips at 60 s (`MAX_VIDEO_SECONDS` in `captureFormat.ts`). Real max length, size and count per item are a backend decision (see contract §9).
- [ ] Stroke width and line style pickers (Figma shows fixed "Red · 4 px"; the data model already supports width and `lineStyle`).
- [ ] Video poster frame / thumbnail (video thumbs currently show an icon).
- [ ] Decide whether closing or cancelling markup should discard the photo. Current behaviour: the original stays attached with no markup.

## Pre-runbook screens
- [ ] **Real map.** The Map and the Overview preview are a static SVG illustration matching the Figma frame. A live tile map (and offline tiles) is not built. The pin, Terrain/Satellite toggle, scale and compass are decorative until then.
- [ ] **Current GPS.** The locate button reads the device GPS on demand and shows it on the Overview. "Confirm Site Location" always confirms the job's location (not the GPS fix), because the Map frame has no GPS control.
- [ ] **Job Overview has no Figma frame for the "Start Survey" bar or tabs.** Frames `556:21316` (Anchored action) and `556:21332` (Action) were never read. I built an anchored Start/Continue/Rework button, plus a "Contacts & access" card with an edit button to reach Site Info. Verify against those frames when Figma access returns.
- [ ] **Returned view card has no button in Figma.** The whole card links to the runbook (Rework). The My Jobs "Rework" button also opens the runbook.
- [ ] **Not-started "Start Survey" goes to the Overview first**; started and returned jobs open the runbook directly (from the My Jobs card).
- [ ] **Required fields on Contacts & Access** (contact name and phone) and the parking option list are my assumptions; the design does not say which fields are mandatory. `siteInfoForm.ts` holds the rules.
- [ ] Fields tagged "from manager" are editable (prefilled). Confirm whether they should be read-only.
- [ ] My Jobs offers the filters All / Not Started / In Progress / Returned; Figma only shows "All Jobs" and "In Progress". Confirm the list.
- [ ] Job title size is the largest existing token (26px); Figma uses about 32px on the Overview.

## Survey Runbook
Items marked **[TBC]** could not be read from the Figma cache; nothing was invented for them.

- [ ] **[TBC] BFD Selector Q01–Q06.** Frames `556:25583`, `25556`, `25529`, `25502`, `25475`, `25448` were never fetched. The carousel (`config/bfdConfig.ts`) uses the six "Decision trail" labels as the six steps, in that order, with whole-number and Yes/No answers. Prompt wording, answer types, helper text and step order must be reconciled with the real frames.
- [ ] **[TBC] BFD recommendation rules.** The Figure 4 decision logic is not in the cache. The mock (`src/mocks/surveyor/bfd.ts`) returns BUDI-1S when business P2P ≥ 2 (the one worked example in Figma) and a placeholder BUDI-M otherwise. The backend owns the real rules.
- [ ] **BFD "Edit Answers" and "Open BFD Selector"** open the same carousel (the frames that would distinguish them are unread).
- [ ] **WHS "Log location / details"** is shown on EVERY question (project rule). Figma shows it only on hazard questions, and the "Logged and flagged in WHS Notes." banner only on hazards answered Yes.
- [ ] **External "— N/A"** is built as a per-item N/A toggle (an interpretation of the grey "— N/A" chip). Confirm intent. Items marked N/A count as done.
- [ ] **External item 8 (sealing)** is satisfied by notes OR a photo (as drawn); the other seven require notes AND evidence.
- [ ] **Internal Network counts.** Figma says "8/11 records" for the shared building record but draws 12 cards; the app derives 9/12 from data. The floor checklist is 18 checks (the two "7" cards are merged into one "Penetration · fire penetration sealing" item). A unit counts its auto-filled identifier as captured, so a fresh unit reads 1/8, not 0/8.
- [ ] **Internal Network "+ Add riser".** Figma has a repeatable "+ Add riser" action under "All relevant riser locations". Not built: the item has one location field and multiple photos.
- [ ] **"Reuse existing evidence · same {floor} asset only"** is drawn but disabled (no picker built). It appears on the floor items that carry it in Figma.
- [ ] **Floor plans:** PDF upload is not supported (images only); equipment blocks are counted but not positioned on the plan; "Draw cable route" and "Add measurements / markup" open the shared markup editor on the first sheet; cable-route length is always "— Pending calibrated route" (needs measured routes); the derived scale is shown as "1 plan width ≈ X m".
- [ ] **NBN "Ground Brownfield"** appears in the Figma summary line but its source is unknown, so it is omitted.
- [ ] **BoM export** is a CSV download labelled "Export .csv" (Figma says ".xlsx"). A real .xlsx needs the backend export endpoint (`GET /jobs/{jobRef}/bom/export`). BoM quantities come from a mock; the real calculation rules are a backend decision.
- [ ] **Pre-flight / completion rules** (what counts as outstanding) are derived from the Figma text; confirm them, in particular: a floor needs at least one completed unit; NBN requires Fibre TV, MDU solution, FDT, pit & pipe and cabling choices plus design notes, site notes and all floor plans ready.
- [ ] **Runbook header** follows Figma (back arrow, title, `ConnectionPill`); the Network toggle is dev-only.
- [ ] **Offline sign-off** is queued locally and shown as "Submission pending sync"; it is never counted as submitted until the server accepts it. After a successful submit every section is read-only (disabled fieldset).
- [ ] **Default building** for a new survey (B1, GF, L1–L4) is a constant until the job API supplies basement levels and floors above ground.
- [ ] The runbook shows one open section at a time (matches the Figma frames); multiple-open is a one-line change.

## Auth / shell
- [ ] `ManagerLayout` contains its own sign-out logic. The Surveyor layout uses the copy in `features/auth/useSignOut.ts`. Consider moving `ManagerLayout` onto that hook (not done; Manager code is off limits for now).
- [ ] Surveyor requests in `surveyorTransport.ts` do not refresh an expired access token. `baseApi`'s refresh logic is private; expose it before pointing the Surveyor API at the real backend.

## Known pre-existing problems (not touched, per instruction)
- 50 existing tests fail without any Surveyor changes (logout, dashboard pagination, job sync and similar).
- `src/app/guards.tsx` fails `react-refresh/only-export-components` (exports `roleHome` next to components).

## Design inconsistencies to confirm with the designer
- Job `MDU001` is used for two jobs; runbook title says "10 Smith St" while My Jobs says "Block A".
- Runbook shows an "Offline" pill while other screens show "Online".
- Internal Network: two cards numbered 7 (floor checklist is counted as 18); shared building record shows 12 cards but the banner says 8/11. See `docs/internal-network-items.md`.
