import { BFD_STEPS, BFD_TOTAL } from '../config/bfdConfig';
import type { BfdData, Issue, RunbookModel } from '../model/types';
import { isBlank, makeSummary, type SectionLogic } from './common';

export function answeredBfd(data: BfdData): number {
  return BFD_STEPS.filter((step) => !isBlank(data.answers[step.code])).length;
}

function issues(model: RunbookModel): Issue[] {
  if (model.data.bfd.selection) return [];
  return [
    {
      sectionKey: 'bfd',
      title: 'BFD selection not saved',
      detail: 'Answer the six BFD questions and save the recommendation.',
    },
  ];
}

export const bfdLogic: SectionLogic = {
  key: 'bfd',
  issues,
  summarize(model) {
    const { bfd } = model.data;
    const done = answeredBfd(bfd);
    return makeSummary({
      complete: !!bfd.selection,
      started: done > 0,
      done,
      total: BFD_TOTAL,
      progress: done / BFD_TOTAL,
      draftChip: done > 0 ? `Draft · ${done}/${BFD_TOTAL}` : 'Draft',
    });
  },
};
