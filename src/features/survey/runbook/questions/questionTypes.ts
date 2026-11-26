// Declarative question definitions. External Network and Internal Network are rendered entirely from these,
// so adding a question or a floor-level check means adding an entry here, not writing UI.

import type { ItemState } from '../model/types';

export interface ChoiceOption {
  value: string;
  label: string;
}

interface FieldBase {
  code: string;
  label: string;
  /** Optional fields never block confirmation. */
  optional?: boolean;
  /** Error shown when a required field is empty. `{subject}` is replaced with the card's subject (e.g. "B1-01"). */
  requiredMessage?: string;
}

export interface TextField extends FieldBase {
  kind: 'text';
  placeholder?: string;
  multiline?: boolean;
}

export interface NumberField extends FieldBase {
  kind: 'number';
  unit?: string;
  min?: number;
  max?: number;
  /** Informational limit with live feedback (e.g. GPO within 3 m). */
  limit?: { max: number; unit: string };
  placeholder?: string;
}

export interface ChoiceField extends FieldBase {
  kind: 'choice';
  options: ChoiceOption[];
  multiple?: boolean;
  /** Selected-chip colour; `warning` is used for "Absent · photo" style choices. */
  warnOn?: string[];
}

export type FieldDef = TextField | NumberField | ChoiceField;

export interface EvidenceDef {
  /** Minimum photos/videos. 0 = optional. */
  min: number;
  video?: boolean;
  /** Only ask for evidence when a field has this value (e.g. "photo only if present"). */
  visibleWhen?: { field: string; equals: string };
  /** Shown when evidence is still missing, e.g. "A GPO proximity photo is still required." */
  pendingHint?: string;
}

export interface QuestionDef {
  code: string;
  label: string;
  /** Marks the question mandatory (adds *, "Missing" rather than "Pending"). */
  required?: boolean;
  /** Short name used in "Missing: ..." summaries and the "Resolve ..." hint. */
  shortName?: string;
  hint?: string;
  /** Amber "Reference: ... EXAMPLE ONLY" block (External). */
  reference?: string;
  /** Static helper line under the fields. */
  helper?: string;
  /** Amber banner inside the card. */
  banner?: string;
  fields: FieldDef[];
  evidence?: EvidenceDef;
  /** "Reuse existing evidence · same {floor} asset only" button. */
  reuseEvidence?: boolean;
  /** Satisfied by ANY of these fields / evidence instead of requiring each (External sealing item). */
  anyOf?: { fields: string[]; evidence: boolean; message: string; missing?: string };
  /** Field whose value is echoed in the status chip once captured (e.g. "1200 mm"). */
  chipField?: string;
  /** Chip text for a confirmed card whose chip field is empty (e.g. "Clear" when nothing is selected). */
  emptyChip?: string;
  /** Auto-confirmed identifier cards (unit identifier). */
  auto?: boolean;
  /** Derived text under the fields (e.g. EUP total, calibration scale). */
  footnote?: (state: ItemState) => string | null;
}

export type CardVariant = 'external' | 'checklist';
