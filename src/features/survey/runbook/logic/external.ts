import { EXTERNAL_QUESTIONS, EXTERNAL_TOTAL } from '../config/externalConfig';
import type { Issue, ItemState, RunbookModel } from '../model/types';
import { isItemDone, parseNumber } from '../questions/questionLogic';
import { isBlank, makeSummary, type SectionLogic } from './common';

export const externalDoneCount = (items: Record<string, ItemState>): number =>
  EXTERNAL_QUESTIONS.filter((question) => isItemDone(items[question.code])).length;

/** First item that is not yet confirmed (drives the blocking banner and hints). */
export const firstPendingExternal = (items: Record<string, ItemState>) =>
  EXTERNAL_QUESTIONS.find((question) => !isItemDone(items[question.code]));

/** Letterbox-confirmed total premises (residential + commercial + essential services). */
export function eupTotal(items: Record<string, ItemState>): number | null {
  const state = items['ext.eupCount'];
  if (!state?.confirmed) return null;
  return ['residential', 'commercial', 'essential'].reduce((sum, code) => sum + (parseNumber(state.values[code]) ?? 0), 0);
}

function issues(model: RunbookModel): Issue[] {
  const { items, siteNotes } = model.data.external;
  const found: Issue[] = EXTERNAL_QUESTIONS.filter((question) => !isItemDone(items[question.code])).map((question) => ({
    sectionKey: 'external',
    title: question.issueTitle ?? question.label,
    detail: question.issueDetail ?? 'Capture the required evidence and notes, then confirm the item.',
  }));
  // Missing notes are reported only when nothing else in the section is outstanding (one group per section).
  if (found.length === 0 && isBlank(siteNotes)) {
    found.push({
      sectionKey: 'external',
      title: 'External site surveyor notes',
      detail: 'Add the mandatory site surveyor notes for External Network & Site Entry.',
    });
  }
  return found;
}

export const externalLogic: SectionLogic = {
  key: 'external',
  issues,
  summarize(model) {
    const { items, siteNotes } = model.data.external;
    const done = externalDoneCount(items);
    return makeSummary({
      complete: model.completed.external && issues(model).length === 0,
      started: done > 0 || !isBlank(siteNotes),
      done,
      total: EXTERNAL_TOTAL,
      progress: done / EXTERNAL_TOTAL,
      draftChip: `Draft · ${done}/${EXTERNAL_TOTAL}`,
    });
  },
};
