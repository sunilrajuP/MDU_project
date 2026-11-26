import type { SectionKey } from '@/types/surveyor';
import { SECTION_ORDER } from '../model/defaults';
import type { Issue, RunbookModel, SectionSummary } from '../model/types';
import { bfdLogic } from './bfd';
import { bomLogic } from './bom';
import { makeSummary, type SectionLogic } from './common';
import { externalLogic } from './external';
import { floorPlansLogic } from './floorPlans';
import { internalLogic } from './internal';
import { nbnLogic } from './nbn';
import { whsLogic } from './whs';

/** Sections whose issues feed Pre-flight Validation, in runbook order. */
const VALIDATED: SectionLogic[] = [whsLogic, bfdLogic, externalLogic, internalLogic, floorPlansLogic, nbnLogic, bomLogic];

/** Every blocking issue in the survey, grouped by the section that owns it. */
export function computeIssues(model: RunbookModel): Issue[] {
  return VALIDATED.flatMap((logic) => logic.issues(model));
}

const preflightLogic: SectionLogic = {
  key: 'preflight',
  issues: () => [],
  summarize(model) {
    const issues = computeIssues(model);
    const clean = VALIDATED.filter((logic) => logic.issues(model).length === 0).length;
    const summary = makeSummary({
      complete: issues.length === 0,
      started: true,
      done: clean,
      total: VALIDATED.length,
      progress: clean / VALIDATED.length,
      draftChip: 'Needs attention',
      completeChip: 'Ready',
      draftTone: 'warning',
    });
    return summary;
  },
};

const signoffLogic: SectionLogic = {
  key: 'signoff',
  issues: () => [],
  summarize(model) {
    const { signoff } = model.data;
    if (signoff.submittedAt) return makeSummary({ complete: true, started: true, done: 1, total: 1, progress: 1, draftChip: '', completeChip: 'Submitted' });
    if (computeIssues(model).length > 0) {
      return { status: 'locked', chip: 'Locked', tone: 'neutral', progress: 0, done: null, total: null };
    }
    return {
      status: 'in_progress',
      chip: signoff.pendingSubmit ? 'Submission pending sync' : 'Ready to sign off',
      tone: signoff.pendingSubmit ? 'warning' : 'brand',
      progress: 0,
      done: null,
      total: null,
    };
  },
};

export const SECTION_LOGIC: Record<SectionKey, SectionLogic> = {
  whs: whsLogic,
  bfd: bfdLogic,
  external: externalLogic,
  internal: internalLogic,
  floorPlans: floorPlansLogic,
  nbnDesign: nbnLogic,
  bom: bomLogic,
  preflight: preflightLogic,
  signoff: signoffLogic,
};

export type SummaryMap = Record<SectionKey, SectionSummary>;

export function computeSummaries(model: RunbookModel): SummaryMap {
  const entries = SECTION_ORDER.map((key) => [key, SECTION_LOGIC[key].summarize(model)] as const);
  return Object.fromEntries(entries) as SummaryMap;
}

export interface Progress {
  completeCount: number;
  total: number;
  percent: number;
  /** First section that is neither complete nor locked: the "Continue" target. */
  current: SectionKey | null;
}

export function computeProgress(summaries: SummaryMap): Progress {
  const completeCount = SECTION_ORDER.filter((key) => summaries[key].status === 'complete').length;
  const current = SECTION_ORDER.find((key) => summaries[key].status !== 'complete' && summaries[key].status !== 'locked') ?? null;
  return {
    completeCount,
    total: SECTION_ORDER.length,
    percent: Math.round((100 * completeCount) / SECTION_ORDER.length),
    current,
  };
}
