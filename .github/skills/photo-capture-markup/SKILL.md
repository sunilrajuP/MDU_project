---
name: photo-capture-markup
description: Use when building camera capture, photo slots, the markup canvas, or anything touching original vs marked-up photos.
---

# Photo capture & markup

## Data
- `Photo { id, sessionId, itemCode, floorCode?, originalMediaId, thumbMediaId, takenAt, exif? }`
- `Markup { id, photoId, objects: MarkupObject[], markedMediaId, purpose?, updatedAt }`
- `MarkupObject = { id, kind: 'line'|'arrow'|'rect'|'shape'|'dimension'|'callout'|'text', points, style:{lineStyle,colorToken,widthToken}, text? }`

## Flow
Take Photo → preview → **Retake | Use Photo** → persist original (Dexie `media`) → show ✓ → optional **Markup**.

## Rules
1. **Original is immutable (H5).** Never draw on it, never overwrite `originalMediaId`. Add a test hashing the blob before/after markup.
2. Re-edit works from `objects` (vector), then re-render `markedMediaId`.
3. Tag burned into the marked copy: `floor · item code`, floor colour token.
4. Line styles: solid, dashed, dotted, dash-dot, phantom (`setLineDash`). Undo/redo stack per session; select/move/reshape/recolour/delete.
5. Multiple photos per item; item satisfied when `photoIds.length >= min`.
6. Persist before confirming success; on quota error show a clear message and keep the capture in memory for retry.
7. Don't put Blobs in Redux; use object URLs and revoke them.
8. Colours from CSS custom properties (H3). Hit areas ≥ 44 px; pointer events for touch/pen.
9. Video (supplementary): capped length/size/count; poster frame; never replaces required photos.

## Tests
Capture→persist→hydrate; markup preserves original; undo/redo; marked copy regenerated after edit.
