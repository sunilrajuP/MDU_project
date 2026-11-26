// BFD Selection Wizard.
//
// [TBC] The six "BFD Selector / Tablet / Question 01–06" Figma frames (556:25583, 25556, 25529, 25502, 25475,
// 25448) were not readable (Figma call limit). Until they are fetched, the six steps below use the six
// "Decision trail · Figure 4" labels shown in the runbook section, in that order. Prompt wording, answer types,
// helper text and step order must be reconciled with the real frames (tracked in docs/surveyor-backlog.md).

export interface BfdStep {
  code: string;
  prompt: string;
  /** `count` is a whole number; `yesNo` is Yes / No. */
  type: 'count' | 'yesNo';
  /** Extra free-text note collected with the answer (e.g. "GF shops"). */
  note?: { code: string; label: string };
}

export const BFD_FIGURE = 'Figure 4';

export const BFD_STEPS: BfdStep[] = [
  { code: 'floorsAboveGround', prompt: 'Floors above ground', type: 'count' },
  { code: 'basementLevels', prompt: 'Basement levels', type: 'count' },
  { code: 'gponPremises', prompt: 'GPON end-user premises', type: 'count' },
  {
    code: 'businessP2p',
    prompt: 'Potential business (P2P) locations',
    type: 'count',
    note: { code: 'businessP2pNote', label: 'Where are they?' },
  },
  { code: 'fibreTv', prompt: 'Fibre TV required', type: 'yesNo' },
  { code: 'fdtLikely', prompt: 'FDT installation likely', type: 'yesNo' },
];

export const BFD_TOTAL = BFD_STEPS.length;

/** Decision-trail value as shown in the section, e.g. "2 · GF shops". */
export function answerDisplay(step: BfdStep, answers: Record<string, string>): string {
  const value = answers[step.code];
  if (value === undefined || value === '') return '—';
  const note = step.note ? answers[step.note.code] : '';
  const base = step.type === 'yesNo' ? (value === 'yes' ? 'Yes' : 'No') : value;
  return note ? `${base} · ${note}` : base;
}
