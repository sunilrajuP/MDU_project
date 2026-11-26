// Runbook data model: what each of the 9 sections stores. Everything here is plain JSON so it can be saved
// through the API, persisted to Dexie, and round-tripped unchanged. Counts, percentages and statuses are NEVER
// stored; they are derived from this data (see each section's logic file).

import type { MediaAttachment, SectionKey } from '@/types/surveyor';

/** Number fields are kept as the raw text the user typed, so partial input ("2.") is never lost. */
export type FieldValue = string | string[] | null;

/** Answers + evidence for one checklist item (a question card). */
export interface ItemState {
  values: Record<string, FieldValue>;
  media: MediaAttachment[];
  confirmed: boolean;
  /** Marked "not applicable" (External items). */
  na?: boolean;
}

// 1. WHS Check ---------------------------------------------------------------------------------------
export type YesNoNa = 'yes' | 'no' | 'na';
export interface WhsAnswer {
  value: YesNoNa | null;
  details: string;
}
export interface WhsData {
  answers: Record<string, WhsAnswer>;
  hazardNotes: string;
  siteNotes: string;
  completedAt?: string;
}

// 2. BFD Selection Wizard ----------------------------------------------------------------------------
export interface BfdSelection {
  code: string;
  name: string;
  spec: string;
  rationale: string;
  figure: string;
  savedAt: string;
}
export interface BfdData {
  answers: Record<string, string>;
  selection: BfdSelection | null;
}

// 3. External Network & Site Entry -----------------------------------------------------------------
export interface ExternalData {
  items: Record<string, ItemState>;
  siteNotes: string;
}

// 4. Internal Network ---------------------------------------------------------------------------------
export interface FloorDef {
  /** Stable identifier (B1, GF, L1 ...). Renaming changes `name` only. */
  code: string;
  name: string;
  /** Basement floors get the extra basement checks. */
  kind: 'basement' | 'above';
}
export interface UnitState {
  /** Stable for the life of the survey; never reused after a unit is removed. */
  id: string;
  /** Display label, e.g. B1-01. */
  label: string;
  items: Record<string, ItemState>;
  completed: boolean;
}
export interface FloorState {
  checklist: Record<string, ItemState>;
  basement: Record<string, ItemState>;
  units: UnitState[];
  /** Highest unit number ever issued on this floor (labels never repeat). */
  unitSeq: number;
}
export interface InternalData {
  floors: FloorDef[];
  building: Record<string, ItemState>;
  buildingConfirmed: boolean;
  /** Keyed by floor code. Entries survive floor removal so data is archived, not lost. */
  byFloor: Record<string, FloorState>;
  siteNotes: string;
}

// 5. Floor Plans ---------------------------------------------------------------------------------------
export interface Calibration {
  /** Normalised 0–1 positions on the plan image; null until selected. */
  pointA: [number, number] | null;
  pointB: [number, number] | null;
  /** Real-world distance between A and B, in metres (raw text). */
  distanceM: string;
  /** Image width / height, needed to turn normalised points into a scale. */
  imageAspect: number;
}
export interface Device {
  id: string;
  type: string;
}
export interface PlanState {
  /** Uploaded / captured plan sheets (images). */
  media: MediaAttachment[];
  calibration: Calibration | null;
  devices: Device[];
  notes: string;
  reviewed: boolean;
  ready: boolean;
}
export interface FloorPlansData {
  byFloor: Record<string, PlanState>;
  siteNotes: string;
}

// 6. NBN Design Inputs ---------------------------------------------------------------------------------
export interface NbnData {
  /** Site survey details. Undefined = not overridden (the value flows in from other sections). */
  site: Partial<Record<'floors' | 'basement' | 'eup' | 'commonAreas' | 'p2p' | 'fibreTv' | 'mduSolution', string>>;
  design: Partial<Record<'fdt' | 'pitPipe' | 'cabling', string>> & { notes?: string };
  siteNotes: string;
}

// 7. BoM Review & Confirm -----------------------------------------------------------------------------
export interface BomData {
  rows: Record<string, { confirmed: boolean; quantity?: string }>;
}

// 8. Pre-flight has no stored data (derived).
export type PreflightData = Record<string, never>;

// 9. Surveyor Sign-off & Submit -------------------------------------------------------------------------
export interface SignoffData {
  declaration: boolean;
  signedAt?: string;
  /** Signed offline: submission is queued and is NOT a submitted state until the server accepts it. */
  pendingSubmit?: boolean;
  submittedAt?: string;
}

export interface SectionDataMap {
  whs: WhsData;
  bfd: BfdData;
  external: ExternalData;
  internal: InternalData;
  floorPlans: FloorPlansData;
  nbnDesign: NbnData;
  bom: BomData;
  preflight: PreflightData;
  signoff: SignoffData;
}

export type SectionDataFor<K extends SectionKey> = SectionDataMap[K];

/** Everything the pure logic functions need to derive statuses, counts and issues. */
export interface RunbookModel {
  jobRef: string;
  surveyorName: string;
  data: SectionDataMap;
  /** Explicit "Section Complete" confirmations. */
  completed: Record<SectionKey, boolean>;
  /** BoM rows from the API (quantities in `data.bom` override them). */
  bomRows: import('@/types/surveyor').BomRow[];
}

export type SummaryTone = 'success' | 'brand' | 'warning' | 'neutral' | 'danger';

export interface SectionSummary {
  /** not started / in progress / complete / locked, derived. */
  status: 'not_started' | 'in_progress' | 'complete' | 'locked';
  /** Chip text exactly as shown in the section header. */
  chip: string;
  tone: SummaryTone;
  /** 0..1 fill of the header progress bar. */
  progress: number;
  /** Counts used for the chip and the guide; null when the section has no countable items. */
  done: number | null;
  total: number | null;
}

/** A blocking problem surfaced in Pre-flight Validation and used to gate "Section Complete". */
export interface Issue {
  sectionKey: SectionKey;
  /** Short title for the pre-flight card. */
  title: string;
  detail: string;
}
