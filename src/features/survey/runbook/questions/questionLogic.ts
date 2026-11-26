// Pure validation / status derivation for question cards. No React, no storage.

import type { ItemStatus } from '@/types/surveyor';
import type { FieldValue, ItemState } from '../model/types';
import type { FieldDef, QuestionDef } from './questionTypes';

export const emptyItem = (): ItemState => ({ values: {}, media: [], confirmed: false });

export function textOf(value: FieldValue | undefined): string {
  if (Array.isArray(value)) return value.join(', ');
  return value ?? '';
}

export function isFilled(value: FieldValue | undefined): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return (value ?? '').trim() !== '';
}

export function parseNumber(value: FieldValue | undefined): number | null {
  const text = textOf(value).trim();
  if (text === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function evidenceVisible(def: QuestionDef, state: ItemState): boolean {
  const rule = def.evidence?.visibleWhen;
  if (!def.evidence) return false;
  return rule ? textOf(state.values[rule.field]) === rule.equals : true;
}

export function evidenceRequired(def: QuestionDef, state: ItemState): number {
  if (!def.evidence || !evidenceVisible(def, state)) return 0;
  return def.evidence.min;
}

export function fieldError(field: FieldDef, state: ItemState, subject: string): string | null {
  const value = state.values[field.code];
  if (!isFilled(value)) {
    if (field.optional) return null;
    return (field.requiredMessage ?? 'This field is required.').replace('{subject}', subject);
  }
  if (field.kind === 'number') {
    const parsed = parseNumber(value);
    if (parsed === null) return 'Enter a number.';
    if (field.min !== undefined && parsed < field.min) return `Must be at least ${field.min}.`;
    if (field.max !== undefined && parsed > field.max) return `Must be at most ${field.max}.`;
  }
  return null;
}

export interface ItemIssues {
  /** Field code -> message (for inline errors). */
  fields: Record<string, string>;
  /** True when required evidence is missing. */
  evidence: boolean;
  /** Message for the either-or rule (anyOf), if unmet. */
  anyOf: string | null;
  /** Total number of unmet requirements; 0 = ready to confirm. */
  count: number;
}

export function itemIssues(def: QuestionDef, state: ItemState, subject = ''): ItemIssues {
  if (state.na) return { fields: {}, evidence: false, anyOf: null, count: 0 };

  const anyOfCodes = new Set(def.anyOf?.fields ?? []);
  const fields: Record<string, string> = {};
  for (const field of def.fields) {
    if (anyOfCodes.has(field.code)) continue;
    const error = fieldError(field, state, subject);
    if (error) fields[field.code] = error;
  }

  let anyOf: string | null = null;
  if (def.anyOf) {
    const hasField = def.anyOf.fields.some((code) => isFilled(state.values[code]));
    const hasEvidence = def.anyOf.evidence && state.media.length > 0;
    if (!hasField && !hasEvidence) anyOf = def.anyOf.message;
  }

  const evidence = !def.anyOf?.evidence && state.media.length < evidenceRequired(def, state);
  const count = Object.keys(fields).length + (evidence ? 1 : 0) + (anyOf ? 1 : 0);
  return { fields, evidence, anyOf, count };
}

export const isItemDone = (state: ItemState | undefined): boolean => !!state && (state.confirmed || !!state.na);

/** Chip + icon state for a card. `showErrors` turns "Missing" into the red "Required". */
export function itemStatus(def: QuestionDef, state: ItemState, showErrors: boolean, subject = ''): ItemStatus {
  if (state.na) return 'not_applicable';
  if (state.confirmed) return 'captured';
  const issues = itemIssues(def, state, subject);
  if (issues.count === 0) return 'pending';
  if (showErrors) return 'required';
  const anyFieldFilled = def.fields.some((field) => isFilled(state.values[field.code]));
  if (issues.evidence && Object.keys(issues.fields).length === 0 && anyFieldFilled) return 'photo_pending';
  return def.required ? 'missing' : 'pending';
}

export function statusLabel(status: ItemStatus): string {
  switch (status) {
    case 'captured':
      return 'Captured';
    case 'missing':
      return 'Missing';
    case 'required':
      return 'Required';
    case 'photo_pending':
      return 'Photo pending';
    case 'not_applicable':
      return 'N/A';
    case 'clear':
      return 'Clear';
    default:
      return 'Pending';
  }
}

export function statusTone(status: ItemStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'captured':
    case 'clear':
      return 'success';
    case 'required':
      return 'danger';
    case 'not_applicable':
      return 'neutral';
    default:
      return 'warning';
  }
}

/** Counts how many of `defs` are confirmed (or N/A) in `items`. */
export function countDone(defs: QuestionDef[], items: Record<string, ItemState> | undefined): number {
  return defs.filter((def) => isItemDone(items?.[def.code])).length;
}

/** Value echoed in the chip of a captured card (e.g. "1200 mm", "BUDI-1S"). */
export function chipValue(def: QuestionDef, state: ItemState): string | null {
  if (!def.chipField) return null;
  const field = def.fields.find((entry) => entry.code === def.chipField);
  const raw = state.values[def.chipField];
  if (!field) return null;
  if (!isFilled(raw)) return def.emptyChip ?? null;
  if (field.kind === 'choice') {
    const values = Array.isArray(raw) ? raw : [raw as string];
    return values.map((value) => field.options.find((option) => option.value === value)?.label ?? value).join(' · ');
  }
  return field.kind === 'number' && field.unit ? `${textOf(raw)} ${field.unit}` : textOf(raw);
}
