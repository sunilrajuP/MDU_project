import type { SectionKey } from '@/types/surveyor';
import type { Issue, RunbookModel, SectionSummary, SummaryTone } from '../model/types';

/** What every section module provides. All functions are pure and derive everything from the model. */
export interface SectionLogic {
  key: SectionKey;
  summarize: (model: RunbookModel) => SectionSummary;
  /** Blocking problems (also gate "Section Complete" and feed Pre-flight Validation). */
  issues: (model: RunbookModel) => Issue[];
}

interface SummaryInput {
  complete: boolean;
  started: boolean;
  done: number | null;
  total: number | null;
  progress: number;
  /** Chip when not complete, e.g. "Draft · 7/8". */
  draftChip: string;
  completeChip?: string;
  draftTone?: SummaryTone;
}

export function makeSummary(input: SummaryInput): SectionSummary {
  if (input.complete) {
    return {
      status: 'complete',
      chip: input.completeChip ?? 'Completed',
      tone: 'success',
      progress: 1,
      done: input.done,
      total: input.total,
    };
  }
  return {
    status: input.started ? 'in_progress' : 'not_started',
    chip: input.draftChip,
    tone: input.draftTone ?? 'neutral',
    progress: Math.min(1, Math.max(0, input.progress)),
    done: input.done,
    total: input.total,
  };
}

/** "a, b and c" */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export const isBlank = (value: string | undefined | null): boolean => (value ?? '').trim() === '';
