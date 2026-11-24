---
name: checklist-engine
description: Use when adding or changing checklist groups/items, per-floor repetition, measurements, advisories, photo requirements, or standard references. Checklist is configuration data.
---

# Checklist engine

## Config (`src/config/checklist/*.json`)
```json
{
  "code": "BFD-HEIGHT",
  "group": "bfd-poc",
  "title": "BFD mounting height",
  "category": "mandatory",
  "perFloor": false,
  "basementOnly": false,
  "photo": { "required": true, "min": 1 },
  "measurements": [{ "key": "heightMm", "unit": "mm", "limits": { "min": 400, "max": 1800 } }],
  "standardRef": { "clause": "…", "page": 0 },
  "exemplar": null
}
```
Groups: `external-network`, `bfd-poc`, `risers`, `floor` (per-floor), `eup`, `common-areas`. Expand `perFloor` items for every floor; show `basementOnly` only on `B*` floors.

## State per item (persisted)
`{ id, sessionId, itemCode, floorCode?, status, notes, measurements{}, photoIds[], markedPhotoIds[], videoIds[], confirmedAt? }`.

## Behaviour
- **Mandatory** blocks sign-off; **Standard** is flagged in the report only.
- Out-of-range measurement ⇒ non-blocking **advisory** (record reality; design is informed). Never refuse input.
- Domain constants (20 m ICD, 3 m GPO, 400–1800 mm, 1000/150/500 mm clearances, prohibited locations) live in `src/config/rules/standards.ts` with a `reviewedAgainst` version string — the standard is revised periodically.
- Each group: mandatory surveyor notes + explicit "section complete".
- Some items auto-derive from plan state; render read-only with a link to fix.
- Validation consumes the same config (single definition of "complete").

## Adding an item
1. Add JSON entry. 2. Add measurement/advisory rule if needed. 3. Update traceability doc (FR-5.x). 4. Tests: renders, validates, advisory triggers, per-floor repeat. 5. If new persisted field ⇒ run `dexie-redux-rehydration` + `dexie-schema-versioning`.
