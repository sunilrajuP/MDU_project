# Internal Network: extracted items (for confirmation)

Source: Figma frame `556:23753` (Survey Runbook, section 4 expanded), tablet, read from 13 full-resolution slices. No other Internal Network frame exists on the page. All floor, unit and question content is data-driven (config), never hardcoded per floor.

## Hierarchy

```
Internal Network (section 4)
├─ Summary banner (derived: building records, floor checks, unit checks, pending sync)
├─ Floors strip: B1 · GF · L1 · L2 · L3 · L4   [Configure floors]   (6 floors, list can grow)
│    counts shown on each tab: B1 0/23, GF 0/18, L1 0/18, L2 0/18, L3 0/18, L4 0/18
├─ Per selected floor (Figma shows B1 only; the rest are assumed to repeat the same structure)
│    ├─ Units (B1 shows "2 units", "0/2 units complete")
│    │    ├─ Unit B1-01 (expanded, 2/8)  ─ 8 questions
│    │    ├─ Unit B1-02 (collapsed, 0/8) ─ same 8 questions
│    │    └─ [+ Add Unit]
│    ├─ Building-level shared PoC / BFD record (captured once per building, referenced by B1)
│    ├─ Floor-level checklist ─ 18 standard checks
│    └─ Basement-only checks (B1 only, not applicable GF–L4) ─ 5 checks
├─ Site Surveyor Notes * (mandatory)
└─ [Section Complete]
```

## Counts

| Group | Items | Figma's own count | Match |
|---|---|---|---|
| Unit questions (per unit) | **8** | "2/8", "0/8" | yes |
| Floor-level checklist (per floor) | **18** (19 cards) | "0/18 standard checks" | see note 1 |
| Basement-only checks (basement floors) | **5** | "0/5" | yes |
| B1 total = 18 + 5 | **23** | "B1 0/23" | yes |
| Building-level shared record | **12 cards** | "8/11 records", "3 pending" | see note 2 |
| Site Surveyor Notes | 1 (mandatory) | – | – |

Notes:
1. The floor checklist has two cards numbered **7** ("Penetration" with Wall/Floor buttons and Comments, then "Fire penetration sealing · photo"). Figma counts 18, so I read "Penetration" as a parent selector for item 7, not a separate check.
2. The shared record shows 12 cards (9 captured + 3 pending), but the banner says 8/11. I read BEP and "PoC / BFD location + photo" as two cards over the same fields (Location, Photo).

## A. Unit questions (8, repeated for every unit, answers stored per unit)

| # | Question | Input | Required |
|---|---|---|---|
| U1 | Unit identifier · Linked floor | text (`B1-01 · Linked MDU001/B1`), auto-filled | – |
| U2 | Representative entry photo | photo/video (min one per floor) | yes |
| U3 | Proposed NTD location | text | yes |
| U4 | GPO proximity distance + photo | number (m), 3 m limit hint, plus photo/video | yes |
| U5 | Existing ICD / NTD at entry if present | Yes / No (photo only if present) | no |
| U6 | Door-entry pathway | Conduit / Cavity / Surface mount, plus photo/video | yes |
| U7 | SDT-to-ICD/NTD distance (m) | number (error: "Enter the measured distance for B1-01. No value has been copied from another unit.") | yes |
| U8 | ICD required · 20 m threshold | Yes / No / Per apartment, then **Mark unit complete** | yes |

Each card has a status chip (Missing, Required, Photo pending, Captured), a collapse chevron, and **Confirm item complete** (disabled until valid). The unit header has a "Unit evidence is independent. Missing: …" warning and **Draft · 2/8**.

## B. Floor-level checklist (18, per floor)

| # | Check | Fields |
|---|---|---|
| F1 | Fire escape plan · photo · two-point calibration | photo/video; calibration points A/B (derived); real-world calibration distance (m); derived scale |
| F2 | General floor / corridor photo | General corridor photo (text); photo/video |
| F3 | All relevant riser locations · individual evidence | Riser location (text); photo/video; **+ Add riser** (repeatable) |
| F4 | Riser dimensions · height × width | height (mm); width (mm) |
| F5 | Conduit / tray type · size · available capacity · photo | Containment type (Conduit / Tray / Other); size (mm); available capacity; photo/video; **Reuse existing evidence · same B1 asset only** |
| F6 | Fire rating | Fire-rated / Non-rated / Unknown |
| F7 | Penetration | Wall Penetration / Floor Penetration buttons; Comments |
| F7b | Fire penetration sealing · photo | Seal condition (Intact / Damaged / Absent / Unknown); photo/video |
| F8 | Access security · locked / unlocked / restricted · photo | Locked / Unlocked / Restricted; photo/video; Access notes |
| F9 | SDT mounting location · photo | text; photo/video |
| F10 | Mounting surface suitability · prohibited-location check | Surface suitability (Suitable / Not suitable / Unknown); Prohibited-location conflict (Yes / No / Unknown); Prohibited location (Fire stairs, Lobby, Hallway, Wet area, Boiler-plant room, Kitchen) |
| F11 | Horizontal pathway type | Conduit / Ceiling void / Cavity wall / Clear Track / External / None |
| F12 | Clear Track exclusion check | Return air / Boiler / Wet areas / Balconies / Carparks |
| F13 | Pathway switchboard clearance ≥1000 mm | measured clearance (mm) |
| F14 | Measured annotated conduit / tray runs (no zero-length) | measured run length (mm); plan evidence |
| F15 | Route · equipment blocks · dimension annotations reviewed | Route review (text) |
| F16 | Corridor dimensions · width AND height · photo | width (mm); height (mm); photo/video (status shows "N/A · conduit") |
| F17 | Tray condition · capacity AND damage (distinct) | existing tray condition; existing tray capacity; damage (Yes / No / Unknown); Reuse existing evidence |
| F18 | Fire-rated wall penetration identification · photo | Fire-rated wall penetrations (text); photo/video; Reuse existing evidence |

Floor header: "0/18 standard checks confirmed" with an amber banner: "Reuse existing evidence only for the same physical asset on B1. Never assume cross-floor reuse."

## C. Basement-only checks (5, basement floors only)

| # | Check | Fields |
|---|---|---|
| BS1 | Basement access · photo | text (e.g. "Roller door · escorted access"); photo/video |
| BS2 | PoC / BFD location confirmation | text (e.g. "Shared building BFD-01 in B1"); hint "Do not request a repeat location photo" |
| BS3 | PoC-to-riser pathway · distinct photo + measured distance | length (m); photo/video; banner "distinct PoC-to-riser pathway photo, not the shared BFD location photo" |
| BS4 | Confined-space risk · controls log | Confined-space risk (Yes/No); Controls log (text) |
| BS5 | Plant / meter room locations · NBN equipment exclusion zones | text; photo/video |

## D. Building-level shared PoC / BFD record (one per building, 12 cards)

| # | Item | Fields |
|---|---|---|
| B1 | Building Entry Point (BEP) to Internal Equipment | Location (text); Photo (reference, e.g. "BFD-01 saved locally") |
| B2 | PoC / BFD location + photo | Location; Photo |
| B3 | BFD type | BUDI-1S / BUDI-M / PCD / Unknown |
| B4 | Height from floor reference (400–1800 mm) | mm |
| B5 | Switchboard clearance ≥1000 mm | mm |
| B6 | Pipe clearance ≥150 mm | mm |
| B7 | Gas clearance ≥500 mm | mm |
| B8 | Prohibited-location check | Fire stairs / Lobby / Hallway / Wet area / Boiler-plant room / Kitchen (status "Clear") |
| B9 | NBN label confirmed or absence recorded with photo | Confirmed / Absent-photo; Evidence note |
| B10 | Available port / fibre capacity | text; **required** (error: "Record available ports and fibres for the shared BFD.") |
| B11 | Incoming FSL cable count | 1F / 12F / 2 × 12F |
| B12 | Total riser vertical distance basement-to-top (m) | number |

Footer: **Confirm shared building record**. Banner: "Shared record BFD-01 · Located on B1. B1 references this record; do not duplicate the shared asset form on each floor."

## E. Section-level
- **Site Surveyor Notes \*  (mandatory)**: multi-line text, then **Section Complete**.
- Footer hint: "Complete building records, each floor checklist and each required unit record independently before confirming Internal Network."

## States to build (all seen in Figma)
Missing, Required (red border + message), Pending, Photo pending, Captured, N/A, Clear, Draft, confirm disabled, collapsed, expanded.

## Not visible in this frame
- Whether units on GF–L4 look different (I assume the same 8 questions).
- A remove-unit action (none shown, so none planned unless you want one).
- The "Configure floors" dialog (no frame exists).
