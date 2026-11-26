// External Network & Site Entry: 8 questions, read from the Figma frame (556:23201).
// Every question has photo/video evidence and a mandatory "Notes / confirmation" box, except the last one
// which, as drawn, is satisfied by notes OR a photo.

import type { ItemState } from '../model/types';
import { parseNumber } from '../questions/questionLogic';
import type { FieldDef, QuestionDef } from '../questions/questionTypes';

export interface ExternalQuestion extends QuestionDef {
  /** "Mandatory · Blocks sign-off" vs "Standard". */
  mandatory: boolean;
  /** Text for "Resolve ... before marking this section complete." */
  resolveHint: string;
  /** Text for the "... is still required." banner when this is the blocking item. */
  pendingMessage: string;
  /** Pre-flight card title / detail (defaults to the question label). */
  issueTitle?: string;
  issueDetail?: string;
}

const notes = (message = 'Add notes confirming this item.'): FieldDef => ({
  kind: 'text',
  code: 'notes',
  label: 'Notes / confirmation',
  requiredMessage: message,
});

const evidence = { min: 1, video: true } as const;

const eupTotal = (state: ItemState): number =>
  ['residential', 'commercial', 'essential'].reduce((sum, code) => sum + (parseNumber(state.values[code]) ?? 0), 0);

export const EXTERNAL_QUESTIONS: ExternalQuestion[] = [
  {
    code: 'ext.letterbox',
    label: 'Letterbox bank photographed (all panels, all units legible)',
    mandatory: true,
    resolveHint: 'the letterbox photo',
    pendingMessage: 'Letterbox evidence is still required.',
    reference: 'Straight-on, all panels legible, no glare',
    fields: [notes()],
    evidence: { ...evidence, pendingHint: 'Required: all panels and unit numbers must be legible in the evidence.' },
    hint: 'Required: all panels and unit numbers must be legible in the evidence.',
  },
  {
    code: 'ext.eupCount',
    label: 'EUP count confirmed from letterbox count and entered (residential / commercial / essential services)',
    mandatory: true,
    resolveHint: 'the EUP count',
    pendingMessage: 'The EUP count is still required.',
    reference: 'Same frame used for the unit count',
    fields: [
      { kind: 'number', code: 'residential', label: 'Residential', unit: 'EUP', min: 0 },
      { kind: 'number', code: 'commercial', label: 'Commercial', unit: 'EUP', min: 0 },
      { kind: 'number', code: 'essential', label: 'Essential services', unit: 'EUP', min: 0 },
      notes(),
    ],
    evidence,
    footnote: (state) => `Total confirmed · ${eupTotal(state)} EUP`,
  },
  {
    code: 'ext.pit',
    label: 'FJL or BJL pit located, photographed, and GPS tagged',
    mandatory: true,
    resolveHint: 'the pit evidence',
    pendingMessage: 'Pit evidence is still required.',
    reference: 'Pit lid open, surround visible for context',
    fields: [{ kind: 'text', code: 'gpsTag', label: 'GPS tag', requiredMessage: 'Record the GPS tag.' }, notes()],
    evidence,
  },
  {
    code: 'ext.leadIn',
    label: 'Lead-in conduit from pit to building entry: size, condition, capacity recorded',
    mandatory: true,
    resolveHint: 'the lead-in conduit details',
    pendingMessage: 'Lead-in conduit details are still required.',
    reference: 'Conduit entry with size visible/measured',
    fields: [
      { kind: 'text', code: 'size', label: 'Conduit size', requiredMessage: 'Record the conduit size.' },
      { kind: 'text', code: 'condition', label: 'Condition', requiredMessage: 'Record the conduit condition.' },
      { kind: 'text', code: 'capacity', label: 'Available capacity', requiredMessage: 'Record the available capacity.' },
      notes(),
    ],
    evidence,
  },
  {
    code: 'ext.entryPoint',
    label: 'Building cable entry point photographed with measurements',
    mandatory: true,
    resolveHint: 'the cable entry point',
    pendingMessage: 'Cable entry point evidence is still required.',
    reference: 'Wall penetration square-on with context',
    fields: [
      { kind: 'text', code: 'measurements', label: 'Entry point measurements', requiredMessage: 'Record the entry point measurements.' },
      notes(),
    ],
    evidence,
  },
  {
    code: 'ext.entrance',
    label: 'Building entrance photographed (overall view for context)',
    mandatory: true,
    resolveHint: 'the building entrance photo',
    pendingMessage: 'Building entrance evidence is still required.',
    reference: 'Wide shot — entrance and street context',
    fields: [notes()],
    evidence,
  },
  {
    code: 'ext.pitDistance',
    label: 'Pit-to-building distance measured and recorded',
    mandatory: true,
    resolveHint: 'the pit-to-building distance',
    pendingMessage: 'The pit-to-building distance is still required.',
    fields: [{ kind: 'text', code: 'distance', label: 'Distance', requiredMessage: 'Record the distance.' }, notes()],
    evidence,
  },
  {
    code: 'ext.sealing',
    label: 'External conduit sealing condition noted (egress / vermin risk)',
    mandatory: false,
    resolveHint: 'external conduit sealing condition',
    pendingMessage: 'External sealing evidence is still required.',
    issueTitle: 'External conduit sealing condition',
    issueDetail: 'Add sealing notes or a close-up photo, then confirm the item.',
    reference: 'Show sealing condition close-up',
    hint: 'Required: add a close-up photo or notes recording sealing condition and egress / vermin risk.',
    fields: [notes()],
    evidence: { min: 0, video: true },
    anyOf: {
      fields: ['notes'],
      evidence: true,
      message: 'Add sealing notes or a photo to capture this item.',
      missing: 'sealing notes or a close-up photo',
    },
  },
];

export const EXTERNAL_TOTAL = EXTERNAL_QUESTIONS.length;
