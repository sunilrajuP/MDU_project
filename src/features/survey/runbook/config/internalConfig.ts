// Internal Network question sets, read from Figma frame 556:23753 (see docs/internal-network-items.md).
// Everything the section renders comes from here: add a floor check, a unit question or a building record by
// adding an entry. Nothing is hardcoded per floor.

import { parseNumber } from '../questions/questionLogic';
import type { ChoiceOption, FieldDef, QuestionDef } from '../questions/questionTypes';
import type { FloorDef, ItemState } from '../model/types';

const opts = (...labels: string[]): ChoiceOption[] => labels.map((label) => ({ value: label, label }));
const text = (code: string, label: string, extra: Partial<Extract<FieldDef, { kind: 'text' }>> = {}): FieldDef => ({
  kind: 'text',
  code,
  label,
  ...extra,
});
const num = (code: string, label: string, unit: string, extra: Partial<Extract<FieldDef, { kind: 'number' }>> = {}): FieldDef => ({
  kind: 'number',
  code,
  label,
  unit,
  min: 0,
  ...extra,
});
const photo = { min: 1, video: true } as const;

const PROHIBITED = opts('Fire stairs', 'Lobby', 'Hallway', 'Wet area', 'Boiler-plant room', 'Kitchen');

// --- Building-level shared PoC / BFD record (12 cards) --------------------------------------------------
export const BUILDING_ITEMS: QuestionDef[] = [
  {
    code: 'bldg.bep',
    label: 'Building Entry Point (BEP) to Internal Equipment',
    fields: [text('location', 'Location')],
    evidence: photo,
  },
  { code: 'bldg.poc', label: 'PoC / BFD location + photo', fields: [text('location', 'Location')], evidence: photo },
  {
    code: 'bldg.bfdType',
    label: 'BFD type',
    fields: [{ kind: 'choice', code: 'type', label: 'Type', options: opts('BUDI-1S', 'BUDI-M', 'PCD', 'Unknown') }],
    chipField: 'type',
  },
  {
    code: 'bldg.height',
    label: 'Height from floor reference (400–1800 mm)',
    fields: [num('value', 'Height from floor reference', 'mm')],
    chipField: 'value',
  },
  {
    code: 'bldg.switchboard',
    label: 'Switchboard clearance ≥1000 mm',
    fields: [num('value', 'Switchboard clearance', 'mm')],
    chipField: 'value',
  },
  {
    code: 'bldg.pipe',
    label: 'Pipe clearance ≥150 mm',
    fields: [num('value', 'Pipe clearance', 'mm')],
    chipField: 'value',
  },
  {
    code: 'bldg.gas',
    label: 'Gas clearance ≥500 mm',
    fields: [num('value', 'Gas clearance', 'mm')],
    chipField: 'value',
  },
  {
    code: 'bldg.prohibited',
    label: 'Prohibited-location check',
    fields: [{ kind: 'choice', code: 'locations', label: 'Prohibited location', options: PROHIBITED, multiple: true, optional: true }],
    chipField: 'locations',
    emptyChip: 'Clear',
  },
  {
    code: 'bldg.nbnLabel',
    label: 'NBN label confirmed or absence recorded with photo',
    fields: [
      {
        kind: 'choice',
        code: 'status',
        label: 'NBN label status',
        options: opts('Confirmed', 'Absent-photo'),
        warnOn: ['Absent-photo'],
      },
      text('note', 'Evidence note', { optional: true }),
    ],
    chipField: 'status',
  },
  {
    code: 'bldg.portCapacity',
    label: 'Available port / fibre capacity',
    required: true,
    shortName: 'available capacity',
    fields: [
      text('capacity', 'Available port / fibre capacity', {
        requiredMessage: 'Record available ports and fibres for the shared BFD.',
      }),
    ],
  },
  {
    code: 'bldg.fslCount',
    label: 'Incoming FSL cable count',
    required: true,
    shortName: 'incoming FSL count',
    fields: [{ kind: 'choice', code: 'count', label: 'Incoming FSL cable count', options: opts('1F', '12F', '2 × 12F') }],
    chipField: 'count',
  },
  {
    code: 'bldg.riserDistance',
    label: 'Total riser vertical distance basement-to-top (m)',
    required: true,
    shortName: 'total vertical riser distance',
    fields: [num('value', 'Total riser vertical distance (m)', 'm')],
    chipField: 'value',
  },
];

// --- Floor-level checklist (18 standard checks, every floor) ------------------------------------------
const reuse = { reuseEvidence: true } as const;

export const FLOOR_ITEMS: QuestionDef[] = [
  {
    code: 'floor.fireEscapePlan',
    label: 'Fire escape plan · photo · two-point calibration',
    hint: 'Capture the fire escape plan, then select calibration points A and B.',
    fields: [
      text('calibrationPoints', 'Calibration points A / B', { placeholder: 'Pending plan capture' }),
      num('calibrationDistance', 'Real-world calibration distance (m)', 'm'),
    ],
    evidence: photo,
    footnote: (state: ItemState) => {
      if (state.media.length === 0) return 'Scale: pending · No captured plan, no derived scale.';
      const distance = parseNumber(state.values.calibrationDistance);
      return distance ? `Scale: A to B = ${distance} m` : 'Scale: pending · Enter the real-world distance.';
    },
  },
  {
    code: 'floor.corridorPhoto',
    label: 'General floor / corridor photo',
    fields: [text('corridor', 'General corridor photo')],
    evidence: photo,
  },
  {
    code: 'floor.risers',
    label: 'All relevant riser locations · individual evidence',
    fields: [text('riserLocation', 'Riser location')],
    evidence: photo,
    helper: 'Add each riser as its own record with its own photo.',
  },
  {
    code: 'floor.riserDimensions',
    label: 'Riser dimensions · height × width',
    fields: [num('height', 'Riser height (mm)', 'mm'), num('width', 'Riser width (mm)', 'mm')],
  },
  {
    code: 'floor.containment',
    label: 'Conduit / tray type · size · available capacity · photo',
    fields: [
      { kind: 'choice', code: 'type', label: 'Containment type', options: opts('Conduit', 'Tray', 'Other') },
      text('size', 'Size (mm)'),
      text('capacity', 'Available capacity'),
    ],
    evidence: photo,
    ...reuse,
  },
  {
    code: 'floor.fireRating',
    label: 'Fire rating · fire-rated / non-rated / unknown',
    fields: [{ kind: 'choice', code: 'rating', label: 'Fire rating', options: opts('Fire-rated', 'Non-rated', 'Unknown') }],
  },
  {
    code: 'floor.penetration',
    label: 'Penetration · fire penetration sealing · photo',
    fields: [
      { kind: 'choice', code: 'kind', label: 'Penetration', options: opts('Wall Penetration', 'Floor Penetration'), multiple: true },
      { kind: 'choice', code: 'seal', label: 'Seal condition', options: opts('Intact', 'Damaged', 'Absent', 'Unknown') },
      text('comments', 'Comments', { optional: true }),
    ],
    evidence: photo,
  },
  {
    code: 'floor.accessSecurity',
    label: 'Access security · locked / unlocked / restricted · photo',
    fields: [
      { kind: 'choice', code: 'security', label: 'Access security', options: opts('Locked', 'Unlocked', 'Restricted') },
      text('notes', 'Access notes', { optional: true }),
    ],
    evidence: photo,
  },
  {
    code: 'floor.sdtMounting',
    label: 'SDT mounting location · photo',
    fields: [text('location', 'SDT mounting location')],
    evidence: photo,
  },
  {
    code: 'floor.mountingSurface',
    label: 'Mounting surface suitability · prohibited-location check',
    fields: [
      { kind: 'choice', code: 'suitability', label: 'Surface suitability', options: opts('Suitable', 'Not suitable', 'Unknown') },
      { kind: 'choice', code: 'conflict', label: 'Prohibited-location conflict', options: opts('Yes', 'No', 'Unknown') },
      { kind: 'choice', code: 'locations', label: 'Prohibited location', options: PROHIBITED, multiple: true, optional: true },
    ],
  },
  {
    code: 'floor.pathway',
    label: 'Horizontal pathway type',
    fields: [
      {
        kind: 'choice',
        code: 'type',
        label: 'Pathway type',
        options: opts('Conduit', 'Ceiling void', 'Cavity wall', 'Clear Track', 'External', 'None'),
      },
    ],
    chipField: 'type',
  },
  {
    code: 'floor.clearTrack',
    label: 'Clear Track exclusion check',
    fields: [
      {
        kind: 'choice',
        code: 'exclusions',
        label: 'Clear Track exclusion',
        options: opts('Return air', 'Boiler', 'Wet areas', 'Balconies', 'Carparks'),
        multiple: true,
        optional: true,
      },
    ],
  },
  {
    code: 'floor.switchboardClearance',
    label: 'Pathway switchboard clearance ≥1000 mm',
    fields: [num('value', 'Measured clearance (mm)', 'mm')],
  },
  {
    code: 'floor.runs',
    label: 'Measured annotated conduit / tray runs (no zero-length)',
    fields: [num('length', 'Measured run length (mm)', 'mm', { min: 1 }), text('planEvidence', 'Plan evidence')],
  },
  {
    code: 'floor.routeReview',
    label: 'Route · equipment blocks · dimension annotations reviewed',
    fields: [text('review', 'Route review')],
  },
  {
    code: 'floor.corridorDimensions',
    label: 'Corridor dimensions · width AND height · photo',
    fields: [num('width', 'Corridor width (mm)', 'mm'), num('height', 'Corridor height (mm)', 'mm')],
    evidence: photo,
  },
  {
    code: 'floor.trayCondition',
    label: 'Tray condition · capacity AND damage (distinct)',
    fields: [
      text('condition', 'Existing tray condition'),
      text('capacity', 'Existing tray capacity'),
      { kind: 'choice', code: 'damage', label: 'Existing tray damage', options: opts('Yes', 'No', 'Unknown') },
    ],
    ...reuse,
  },
  {
    code: 'floor.firePenetrationId',
    label: 'Fire-rated wall penetration identification · photo',
    fields: [text('penetrations', 'Fire-rated wall penetrations')],
    evidence: photo,
    ...reuse,
  },
];

// --- Basement-only checks (5, basement floors) ------------------------------------------------------------
export const BASEMENT_ITEMS: QuestionDef[] = [
  {
    code: 'bsmt.access',
    label: 'Basement access · photo',
    fields: [text('access', 'Basement access')],
    evidence: photo,
  },
  {
    code: 'bsmt.pocConfirmation',
    label: 'PoC / BFD location confirmation',
    fields: [text('confirmation', 'PoC / BFD location confirmation')],
    helper: 'Do not request a repeat location photo. Use the shared BFD-01 reference only.',
  },
  {
    code: 'bsmt.pocToRiser',
    label: 'PoC-to-riser pathway · distinct photo + measured distance',
    banner: 'Required: distinct PoC-to-riser pathway photo, not the shared BFD location photo.',
    fields: [num('length', 'PoC-to-riser pathway length (m)', 'm')],
    evidence: photo,
  },
  {
    code: 'bsmt.confinedSpace',
    label: 'Confined-space risk · controls log',
    fields: [
      { kind: 'choice', code: 'risk', label: 'Confined-space risk', options: opts('Yes', 'No') },
      text('controls', 'Controls log'),
    ],
    chipField: 'risk',
  },
  {
    code: 'bsmt.plantRoom',
    label: 'Plant / meter room locations · NBN equipment exclusion zones',
    fields: [text('zones', 'Plant / meter room and equipment exclusion zones')],
    evidence: photo,
  },
];

// --- Unit questions (8, identical for every unit; answers stored per unit) -----------------------------
export const UNIT_ITEMS: QuestionDef[] = [
  {
    code: 'unit.identifier',
    label: 'Unit identifier · Linked floor',
    auto: true,
    fields: [text('identifier', 'Unit identifier · Linked floor', { optional: true })],
    hint: 'Unit identifier and linked floor preserved for review.',
  },
  {
    code: 'unit.entryPhoto',
    label: 'Representative entry photo',
    required: true,
    shortName: 'entry photo',
    hint: 'Representative apartment entry photo · minimum one per floor; capture further unit evidence where needed.',
    fields: [],
    evidence: photo,
  },
  {
    code: 'unit.ntdLocation',
    label: 'Proposed NTD location',
    required: true,
    shortName: 'NTD location',
    fields: [text('location', 'Proposed NTD location')],
    helper: 'Record an accessible location inside this unit.',
  },
  {
    code: 'unit.gpo',
    label: 'GPO proximity distance + photo',
    required: true,
    shortName: 'GPO photo',
    fields: [num('distance', 'GPO proximity distance (m)', 'm', { limit: { max: 3, unit: 'm' } })],
    evidence: { ...photo, pendingHint: 'A GPO proximity photo is still required.' },
  },
  {
    code: 'unit.existingIcd',
    label: 'Existing ICD / NTD at entry if present',
    fields: [{ kind: 'choice', code: 'present', label: 'Existing ICD / NTD present', options: opts('Yes', 'No'), optional: true }],
    evidence: { min: 0, video: true, visibleWhen: { field: 'present', equals: 'Yes' } },
    helper: 'Photo only if present.',
  },
  {
    code: 'unit.doorEntry',
    label: 'Door-entry pathway',
    required: true,
    shortName: 'door-entry pathway',
    fields: [{ kind: 'choice', code: 'pathway', label: 'Door-entry pathway', options: opts('Conduit', 'Cavity', 'Surface mount') }],
    evidence: photo,
  },
  {
    code: 'unit.sdtDistance',
    label: 'SDT-to-ICD/NTD distance (m)',
    required: true,
    shortName: 'SDT-to-NTD distance',
    fields: [
      num('distance', 'SDT-to-ICD/NTD distance (m)', 'm', {
        requiredMessage: 'Enter the measured distance for {subject}. No value has been copied from another unit.',
      }),
    ],
  },
  {
    code: 'unit.icdRequired',
    label: 'ICD required · 20 m threshold',
    required: true,
    shortName: 'ICD decision',
    fields: [{ kind: 'choice', code: 'decision', label: 'ICD required', options: opts('Yes', 'No', 'Per apartment') }],
    helper: "Use this unit's measured SDT-to-NTD distance against the 20 m threshold before recording the ICD decision.",
  },
];

/** The unit's last question carries the "Mark unit complete" action instead of its own Confirm button. */
export const UNIT_FINAL_CODE = 'unit.icdRequired';

// --- Default building --------------------------------------------------------------------------------------
// [TBC] The real floor list comes from the job's site details (basement levels / floors above ground).
// Until the job API supplies them, new surveys start with the Figma building.
export const DEFAULT_FLOORS: FloorDef[] = [
  { code: 'B1', name: 'Basement 1', kind: 'basement' },
  { code: 'GF', name: 'Ground Floor', kind: 'above' },
  { code: 'L1', name: 'Level 1', kind: 'above' },
  { code: 'L2', name: 'Level 2', kind: 'above' },
  { code: 'L3', name: 'Level 3', kind: 'above' },
  { code: 'L4', name: 'Level 4', kind: 'above' },
];

export const FLOOR_CHECK_TOTAL = FLOOR_ITEMS.length;
export const BASEMENT_CHECK_TOTAL = BASEMENT_ITEMS.length;
export const UNIT_CHECK_TOTAL = UNIT_ITEMS.length;
export const BUILDING_TOTAL = BUILDING_ITEMS.length;

