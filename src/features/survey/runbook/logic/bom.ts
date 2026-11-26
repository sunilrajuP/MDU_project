import type { BomRow } from '@/types/surveyor';
import type { Issue, RunbookModel } from '../model/types';
import { parseNumber } from '../questions/questionLogic';
import { makeSummary, type SectionLogic } from './common';

/** The quantity in force: the surveyor's override if any, else the API's estimate. */
export function bomQuantity(model: RunbookModel, row: BomRow): number {
  const override = parseNumber(model.data.bom.rows[row.id]?.quantity);
  return override ?? row.quantity;
}

export const isRowConfirmed = (model: RunbookModel, row: BomRow): boolean => !!model.data.bom.rows[row.id]?.confirmed;

export const confirmedRows = (model: RunbookModel): number =>
  model.bomRows.filter((row) => isRowConfirmed(model, row)).length;

/** A flagged row (e.g. conduit fittings) whose quantity is still 0 and has not been explicitly confirmed. */
export const fittingsMissing = (model: RunbookModel): boolean =>
  model.bomRows.some((row) => row.flag && bomQuantity(model, row) === 0 && !isRowConfirmed(model, row));

function issues(model: RunbookModel): Issue[] {
  if (model.bomRows.length === 0) {
    return [{ sectionKey: 'bom', title: 'Bill of materials not loaded', detail: 'Reconnect to load the draft bill of materials.' }];
  }
  const unconfirmed = model.bomRows.length - confirmedRows(model);
  if (unconfirmed === 0) return [];
  return [
    {
      sectionKey: 'bom',
      title: `${unconfirmed} row${unconfirmed === 1 ? '' : 's'} unconfirmed${fittingsMissing(model) ? ' · fittings missing' : ''}`,
      detail: 'Reconcile draft quantities with plans, review fittings and confirm the BoM.',
    },
  ];
}

export const bomLogic: SectionLogic = {
  key: 'bom',
  issues,
  summarize(model) {
    const total = model.bomRows.length;
    const done = confirmedRows(model);
    return makeSummary({
      complete: model.completed.bom && issues(model).length === 0,
      started: done > 0,
      done,
      total,
      progress: total === 0 ? 0 : done / total,
      draftChip: done > 0 ? `${done}/${total} confirmed` : 'Unconfirmed',
    });
  },
};
