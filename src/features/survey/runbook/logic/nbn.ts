import { isBlank, makeSummary, type SectionLogic } from './common';
import { eupTotal } from './external';
import { readyCount } from './floorPlans';
import type { Issue, NbnData, RunbookModel } from '../model/types';

export type SiteKey = keyof NbnData['site'];
export type DesignKey = 'fdt' | 'pitPipe' | 'cabling';

const YES_NO: Record<string, string> = { yes: 'Yes', no: 'No' };
const yesNo = (value: string | undefined) => (value ? YES_NO[value] : undefined);

/**
 * Site survey details flow in from earlier sections ("no double entry"). A value the surveyor typed overrides
 * the flowed-in one; otherwise the derived value is shown.
 */
export function siteValue(model: RunbookModel, key: SiteKey): string | undefined {
  const own = model.data.nbnDesign.site[key];
  if (own !== undefined) return own;
  const { bfd, external } = model.data;
  switch (key) {
    case 'floors':
      return bfd.answers.floorsAboveGround || undefined;
    case 'basement':
      return bfd.answers.basementLevels || undefined;
    case 'p2p':
      return bfd.answers.businessP2p || undefined;
    case 'fibreTv':
      return yesNo(bfd.answers.fibreTv);
    case 'eup': {
      const total = eupTotal(external.items);
      return total === null ? undefined : String(total);
    }
    default:
      return undefined;
  }
}

export function designValue(model: RunbookModel, key: DesignKey): string | undefined {
  const own = model.data.nbnDesign.design[key];
  if (own !== undefined) return own;
  if (key === 'fdt') return yesNo(model.data.bfd.answers.fdtLikely);
  return undefined;
}

const REQUIRED_CHOICES: { label: string; read: (model: RunbookModel) => string | undefined }[] = [
  { label: 'Fibre TV', read: (model) => siteValue(model, 'fibreTv') },
  { label: 'MDU solution', read: (model) => siteValue(model, 'mduSolution') },
  { label: 'FDT installation', read: (model) => designValue(model, 'fdt') },
  { label: 'pit & pipe availability', read: (model) => designValue(model, 'pitPipe') },
  { label: 'cabling solution', read: (model) => designValue(model, 'cabling') },
];

function missingParts(model: RunbookModel): string[] {
  const parts = REQUIRED_CHOICES.filter((choice) => isBlank(choice.read(model))).map((choice) => choice.label);
  if (isBlank(model.data.nbnDesign.design.notes)) parts.push('design input notes');
  return parts;
}

function plansReady(model: RunbookModel): boolean {
  const floors = model.data.internal.floors;
  return readyCount(model.data.floorPlans, floors) === floors.length;
}

function issues(model: RunbookModel): Issue[] {
  const found: Issue[] = [];
  const missing = missingParts(model);
  if (missing.length > 0 || isBlank(model.data.nbnDesign.siteNotes) || !plansReady(model)) {
    found.push({
      sectionKey: 'nbnDesign',
      title: 'Mandatory surveyor notes and plans',
      detail: 'Add design notes and link relevant completed plans.',
    });
  }
  return found;
}

export const nbnLogic: SectionLogic = {
  key: 'nbnDesign',
  issues,
  summarize(model) {
    const total = REQUIRED_CHOICES.length + 2; // choices + design notes + site notes
    const done = total - missingParts(model).length - (isBlank(model.data.nbnDesign.siteNotes) ? 1 : 0);
    return makeSummary({
      complete: model.completed.nbnDesign && issues(model).length === 0,
      started: Object.keys(model.data.nbnDesign.site).length + Object.keys(model.data.nbnDesign.design).length > 0,
      done,
      total,
      progress: done / total,
      draftChip: 'Draft',
    });
  },
};

export { plansReady, missingParts };
