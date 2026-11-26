import { WHS_QUESTIONS } from '../config/whsConfig';
import type { Issue, RunbookModel, WhsData } from '../model/types';
import { isBlank, makeSummary, type SectionLogic } from './common';

/** Hazard questions answered Yes: each is logged into the WHS notes and needs details. */
export function hazardsLogged(data: WhsData): number {
  return WHS_QUESTIONS.filter((question) => question.hazard && data.answers[question.code]?.value === 'yes').length;
}

export function answeredCount(data: WhsData): number {
  return WHS_QUESTIONS.filter((question) => data.answers[question.code]?.value).length;
}

export function whsProblems(data: WhsData): string[] {
  const problems: string[] = [];
  const unanswered = WHS_QUESTIONS.length - answeredCount(data);
  if (unanswered > 0) problems.push(`${unanswered} question${unanswered === 1 ? '' : 's'} unanswered`);
  const missingDetails = WHS_QUESTIONS.filter(
    (question) => question.hazard && data.answers[question.code]?.value === 'yes' && isBlank(data.answers[question.code]?.details),
  ).length;
  if (missingDetails > 0) problems.push(`${missingDetails} hazard${missingDetails === 1 ? '' : 's'} need details`);
  if (isBlank(data.siteNotes)) problems.push('site surveyor notes are required');
  return problems;
}

function issues(model: RunbookModel): Issue[] {
  const problems = whsProblems(model.data.whs);
  if (problems.length === 0) return [];
  return [{ sectionKey: 'whs', title: 'WHS Check incomplete', detail: `${problems.join('; ')}.` }];
}

export const whsLogic: SectionLogic = {
  key: 'whs',
  issues,
  summarize(model) {
    const { whs } = model.data;
    const total = WHS_QUESTIONS.length;
    const done = answeredCount(whs);
    return makeSummary({
      complete: model.completed.whs && issues(model).length === 0,
      started: done > 0 || !isBlank(whs.siteNotes),
      done,
      total,
      progress: done / total,
      draftChip: done > 0 ? `Draft · ${done}/${total}` : 'Draft',
    });
  },
};
