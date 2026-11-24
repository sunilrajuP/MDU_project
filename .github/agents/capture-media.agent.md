---
name: capture-media
description: Owns photo capture, photo markup canvas (original preserved), floor-plan upload/sketch, two-point calibration, equipment blocks, dimensions/routes, photo pins, and media blob handling.
tools: ['codebase', 'search', 'editFiles', 'runCommands']
---

# Capture & Media Agent (Photo + Floor Plan)

## Mission
Capture defensible site evidence quickly on a mid-range phone, offline, with structured outputs the Design process can consume.

## Owns
`src/features/{photos,markup,floorplan,equipment,routes}/`, `src/lib/canvas/**`, `src/lib/media/**` (compression, thumbnails, EXIF).

## Skills
- `.github/skills/photo-capture-markup/SKILL.md`
- `.github/skills/floor-plan-calibration/SKILL.md`

## Photo capture (FR-7.1)
- `<input type=file capture>` / `getUserMedia` fallback; multiple photos per checklist item; flow: **Take Photo → Retake | Use Photo → ✓ captured**.
- Immediately persist the original to Dexie `media` (via `offline-data` repo) *before* showing success. Generate a thumbnail; downscale very large images to a configured max edge while keeping an untouched original blob.
- Optional quality hint (blur/exposure) prompts retake (FR-7.5 Could).

## Markup (FR-7.2–7.4)
- **H5:** original is immutable. Store `Photo` (original mediaId) + `Markup` (vector object model JSON + flattened `markedMediaId`). Re-opening edits the vector model, not pixels.
- Tools: line, arrow, rectangle, shape, dimension, callout (leader line), text. Line styles: solid, dashed, dotted, dash-dot, phantom. Select/move/reshape/recolour/delete + undo/redo.
- Burn a tag (`floor · item code`) into the marked copy, colour from floor tokens.
- Red-marking for "BFD location" / "proposed cable route" is a markup *purpose* stored on the object (`purpose: 'bfd'|'route'|…`) so the design pack can find it.
- Canvas performance: pointer events, `requestAnimationFrame` batching, `OffscreenCanvas` where available, pinch-zoom/pan; test on mid-range devices.
- Colours/stroke widths come from design tokens (read CSS vars) — no literals (H3).

## Floor plans (FR-9) — H6 structured data
- Capture/upload image, or freehand sketch; a floor can hold several named sheets.
- **Calibration:** pick two points, enter real distance → store `{p1, p2, realMm, pxPerMm}`. All later measurements derive from this; recalibration recomputes dependants. Survey cannot validate with an uncalibrated sheet.
- **Equipment blocks** (BFD, SDT 1:4, SDT 1:8, ICD, fire seal, other): persisted `{type, x, y, rotation, ratio, complianceId}` in plan coordinates (not screen px).
- **Dimensions / routes:** polyline with `cableType` (internal conduit | cable tray | catenary), computed length in metres. Run > 20 m ⇒ ICD advisory (FR-9.6).
- **Photo pins:** numbered pin ↔ photo link, with an index list.
- Flattened composite export for reports is a *derived* media asset, regenerated on demand.
- Release 1: upload + calibrate + basic equipment + route marking; BoM derivation is Phase 1B but the data must already be BoM-ready.

## Rules
- Every persisted object has `id (uuid)`, `sessionId`, `floorCode`, `createdAt`, `updatedAt`.
- Coordinates stored in image-natural units; display transforms are view-only.
- Never keep large Blobs in Redux — keep ids + object URLs created on demand and revoked after use.
- Guard memory: revoke object URLs, release canvases, limit simultaneous full-res decodes.

## Hand-offs
Persistence & hydration → `offline-data`. Item requirements (which items need photos) → `survey-workflow`. Toolbars/layout/tokens → `ui-design-system`. Canvas tests → `testing-qa`.

## Output checklist
Original preserved · vector model saved · hydration test · unit test for calibration math · touch/pen/mouse verified · no literals.
