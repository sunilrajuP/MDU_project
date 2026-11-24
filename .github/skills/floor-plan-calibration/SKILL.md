---
name: floor-plan-calibration
description: Use for floor-plan upload/sketch, two-point scale calibration, equipment blocks, dimension/route measurement, photo pins, and the plan data model.
---

# Floor-plan calibration & structured plan data

## Model (all persisted via repos, plan coordinates in image-natural pixels)
```ts
FloorPlanSheet { id, sessionId, floorCode, name, baseMediaId, reviewed: boolean,
                 calibration?: { p1:{x,y}, p2:{x,y}, realMm:number, pxPerMm:number } }
EquipmentBlock { id, sheetId, type:'BFD'|'SDT_1_4'|'SDT_1_8'|'ICD'|'FIRE_SEAL'|'OTHER', x, y, rotation, complianceId? }
Dimension { id, sheetId, points:{x,y}[], cableType:'conduit'|'tray'|'catenary', lengthM }
PhotoPin { id, sheetId, x, y, number, photoId }
```

## Calibration
1. User taps point A and B, enters real distance (e.g. 10 m).
2. `pxPerMm = dist(p1,p2) / realMm`; store it. 
3. `lengthM = polylineLengthPx / pxPerMm / 1000`. Recompute all `Dimension.lengthM` and ICD advisories when recalibrated.
4. Calibration screen blocks entering measurement tools until calibrated.
5. A floor passes validation only with ≥1 sheet that is captured **and** calibrated.

## Equipment & routes
- Blocks scale with the plan (size defined in real mm → px via `pxPerMm`).
- Placing BFD/SDT triggers its placement-compliance checklist (Phase 1B-ready hook; data model reserved).
- Route (e.g. BFD → SDT → apartment) is a `Dimension` with `cableType`; run > 20 m ⇒ ICD advisory.
- Photo pins link plan ↔ photo; keep numbering stable.

## Rules
- Plan is the single source of truth for quantities/lengths (future BoM): don't store derived totals as truth; compute via selectors.
- Flattened composite is derived on demand and never edited.
- Pan/zoom transforms are view-state only.
- Pure geometry functions in `src/lib/geometry/` with unit tests (distance, polyline, transform).

## Tests
Calibration math; recalibration recomputes lengths; reload restores blocks/dimensions/pins; uncalibrated sheet raises `plan-uncalibrated`.
