import { describe, expect, it } from 'vitest';
import { BASEMENT_ITEMS, DEFAULT_FLOORS, FLOOR_ITEMS, UNIT_ITEMS } from '@/features/survey/runbook/config/internalConfig';
import { computeIssues, computeProgress, computeSummaries } from '@/features/survey/runbook/logic';
import { isFloorComplete, isUnitComplete, unitLabel, unitMissingNames } from '@/features/survey/runbook/logic/internal';
import { bomToCsv } from '@/features/survey/runbook/sections/bom/bomExport';
import { defaultSectionData, SECTION_ORDER } from '@/features/survey/runbook/model/defaults';
import type { RunbookModel, UnitState } from '@/features/survey/runbook/model/types';
import {
  emptyItem,
  itemIssues,
  itemStatus,
  statusLabel,
} from '@/features/survey/runbook/questions/questionLogic';
import { MOCK_BOM_ROWS } from '@/mocks/surveyor/bfd';
import { completeItem, completeSections } from './complete-survey';

const blankModel = (): RunbookModel => ({
  jobRef: 'MDU-000004',
  surveyorName: 'Alex Morgan',
  data: defaultSectionData(),
  completed: Object.fromEntries(SECTION_ORDER.map((key) => [key, false])) as RunbookModel['completed'],
  bomRows: MOCK_BOM_ROWS,
});

function completeModel(): RunbookModel {
  const model = blankModel();
  const sections = completeSections();
  for (const key of SECTION_ORDER) Object.assign(model.data, { [key]: sections[key] });
  for (const key of ['whs', 'bfd', 'external', 'internal', 'floorPlans', 'nbnDesign', 'bom'] as const) model.completed[key] = true;
  return model;
}

describe('question logic', () => {
  const sdt = UNIT_ITEMS.find((d) => d.code === 'unit.sdtDistance')!;
  const gpo = UNIT_ITEMS.find((d) => d.code === 'unit.gpo')!;

  it('derives Missing / Required / Photo pending / Captured from the item state', () => {
    expect(statusLabel(itemStatus(sdt, emptyItem(), false))).toBe('Missing');
    expect(statusLabel(itemStatus(sdt, emptyItem(), true))).toBe('Required');
    const withDistance = { ...emptyItem(), values: { distance: '2.4' } };
    expect(statusLabel(itemStatus(gpo, withDistance, false))).toBe('Photo pending');
    expect(statusLabel(itemStatus(gpo, { ...withDistance, confirmed: true }, false))).toBe('Captured');
  });

  it('flags unmet requirements per field and for evidence, with the subject in the message', () => {
    const issues = itemIssues(sdt, emptyItem(), 'B1-01');
    expect(issues.fields.distance).toBe('Enter the measured distance for B1-01. No value has been copied from another unit.');
    expect(itemIssues(gpo, { ...emptyItem(), values: { distance: '2' } }).evidence).toBe(true);
    expect(itemIssues(sdt, { ...emptyItem(), values: { distance: 'abc' } }).fields.distance).toBe('Enter a number.');
  });

  it('only asks for ICD photo evidence when an existing ICD is present', () => {
    const icd = UNIT_ITEMS.find((d) => d.code === 'unit.existingIcd')!;
    expect(itemIssues(icd, { ...emptyItem(), values: { present: 'No' } }).count).toBe(0);
    expect(itemIssues(icd, { ...emptyItem(), values: { present: 'Yes' } }).evidence).toBe(false); // min 0: optional
  });
});

describe('internal network completion', () => {
  const completeUnit = (): UnitState => ({
    id: 'u1',
    label: 'B1-01',
    completed: true,
    items: Object.fromEntries(UNIT_ITEMS.map((d) => [d.code, completeItem(d, 'u')])),
  });
  const basement = DEFAULT_FLOORS[0];
  const above = DEFAULT_FLOORS[1];
  const checks = (defs: typeof FLOOR_ITEMS) => Object.fromEntries(defs.map((d) => [d.code, completeItem(d, 'f')]));

  it('a unit is complete only with all 8 confirmed and the unit marked complete', () => {
    expect(isUnitComplete(completeUnit())).toBe(true);
    expect(isUnitComplete({ ...completeUnit(), completed: false })).toBe(false);
    const missingOne = completeUnit();
    missingOne.items['unit.gpo'] = { ...missingOne.items['unit.gpo'], confirmed: false };
    expect(isUnitComplete(missingOne)).toBe(false);
    expect(unitMissingNames(missingOne)).toEqual(['GPO photo']);
  });

  it('a floor needs its checks, (basement checks on basements) and at least one completed unit', () => {
    const base = { checklist: checks(FLOOR_ITEMS), basement: checks(BASEMENT_ITEMS), units: [completeUnit()], unitSeq: 1 };
    expect(isFloorComplete(basement, base)).toBe(true);
    expect(isFloorComplete(basement, { ...base, basement: {} })).toBe(false); // basement floors need the 5 extra checks
    expect(isFloorComplete(above, { ...base, basement: {} })).toBe(true); // above-ground floors do not
    expect(isFloorComplete(above, { ...base, units: [] })).toBe(false);
    expect(isFloorComplete(above, { ...base, units: [completeUnit(), { ...completeUnit(), id: 'u2', completed: false }] })).toBe(false);
  });

  it('numbers units per floor and never reuses a number', () => {
    expect(unitLabel('GF', 1)).toBe('GF-01');
    expect(unitLabel('L12', 10)).toBe('L12-10');
  });
});

describe('derived summaries, issues and progress', () => {
  it('a blank survey has nothing complete, WHS as the current step, and sign-off locked', () => {
    const model = blankModel();
    const summaries = computeSummaries(model);
    const progress = computeProgress(summaries);

    expect(progress).toMatchObject({ completeCount: 0, percent: 0, current: 'whs' });
    expect(summaries.whs).toMatchObject({ status: 'not_started', chip: 'Draft' });
    expect(summaries.internal.chip).toBe('Draft · 0/6 floors');
    expect(summaries.floorPlans.chip).toBe('0/6 plans ready');
    expect(summaries.bom.chip).toBe('Unconfirmed');
    expect(summaries.preflight).toMatchObject({ chip: 'Needs attention', tone: 'warning' });
    expect(summaries.signoff).toMatchObject({ status: 'locked', chip: 'Locked' });
  });

  it('reports one issue group per section for missing notes only when nothing else is outstanding', () => {
    const model = completeModel();
    model.data.external.siteNotes = '';
    expect(computeIssues(model).map((i) => i.title)).toEqual(['External site surveyor notes']);

    model.data.external.items['ext.sealing'] = emptyItem();
    expect(computeIssues(model).map((i) => i.title)).toEqual(['External conduit sealing condition']);
  });

  it('a fully valid survey has no issues, completes pre-flight and unlocks sign-off', () => {
    const model = completeModel();
    expect(computeIssues(model)).toEqual([]);
    const summaries = computeSummaries(model);
    expect(summaries.preflight.status).toBe('complete');
    expect(summaries.signoff).toMatchObject({ status: 'in_progress', chip: 'Ready to sign off' });
    expect(computeProgress(summaries)).toMatchObject({ completeCount: 8, percent: 89, current: 'signoff' });
  });

  it('submitting completes the final step; a queued (offline) sign-off does not', () => {
    const queued = completeModel();
    queued.data.signoff = { declaration: true, signedAt: 'x', pendingSubmit: true };
    expect(computeSummaries(queued).signoff).toMatchObject({ chip: 'Submission pending sync', tone: 'warning' });
    expect(computeProgress(computeSummaries(queued)).completeCount).toBe(8);

    const submitted = completeModel();
    submitted.data.signoff = { declaration: true, signedAt: 'x', submittedAt: 'y' };
    expect(computeProgress(computeSummaries(submitted))).toMatchObject({ completeCount: 9, percent: 100, current: null });
  });

  it('edits that break a section make it incomplete again (completion is derived, not stored)', () => {
    const model = completeModel();
    expect(computeSummaries(model).whs.status).toBe('complete');
    model.data.whs.siteNotes = '';
    expect(computeSummaries(model).whs.status).not.toBe('complete');
  });

  it('exports the BoM with the quantities in force', () => {
    const model = completeModel();
    model.data.bom.rows.tray = { confirmed: true, quantity: '14' };
    const lines = bomToCsv(model).split('\r\n');
    expect(lines).toHaveLength(16);
    expect(lines.find((l) => l.startsWith('"Cable tray"'))).toContain('"14"');
  });
});
