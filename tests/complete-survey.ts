// Test helper: builds a COMPLETE survey (every section valid) straight from the question configs, then stores it as
// local drafts. Opening the runbook afterwards starts with sign-off unlocked, so submit flows can be tested.

import { getDb } from '@/data/db/getDb';
import { BASEMENT_ITEMS, BUILDING_ITEMS, FLOOR_ITEMS, UNIT_ITEMS, DEFAULT_FLOORS } from '@/features/survey/runbook/config/internalConfig';
import { EXTERNAL_QUESTIONS } from '@/features/survey/runbook/config/externalConfig';
import { WHS_QUESTIONS } from '@/features/survey/runbook/config/whsConfig';
import type { ItemState } from '@/features/survey/runbook/model/types';
import type { QuestionDef } from '@/features/survey/runbook/questions/questionTypes';
import { MOCK_BOM_ROWS } from '@/mocks/surveyor/bfd';
import type { MediaAttachment, SectionKey } from '@/types/surveyor';

const stamp = new Date(2026, 9, 28, 9, 24).toISOString();
const media = (id: string): MediaAttachment => ({ id: `test-${id}`, kind: 'photo', capturedAt: stamp, hasMarkup: false });

/** A confirmed item with every field filled and any required evidence attached. */
export function completeItem(def: QuestionDef, tag: string): ItemState {
  const values: ItemState['values'] = {};
  for (const field of def.fields) {
    if (field.kind === 'choice') values[field.code] = field.multiple ? [field.options[0].value] : field.options[0].value;
    else if (field.kind === 'number') values[field.code] = '2';
    else values[field.code] = 'Recorded';
  }
  const needsMedia = (def.evidence?.min ?? 0) > 0;
  return { values, media: needsMedia ? [media(`${tag}-${def.code}`)] : [], confirmed: true };
}

const items = (defs: QuestionDef[], tag: string) => Object.fromEntries(defs.map((def) => [def.code, completeItem(def, tag)]));

export function completeSections(): Record<SectionKey, Record<string, unknown>> {
  const floors = DEFAULT_FLOORS.map((floor) => ({ ...floor }));
  return {
    whs: {
      answers: Object.fromEntries(WHS_QUESTIONS.map((q) => [q.code, { value: 'yes', details: 'Controls noted' }])),
      hazardNotes: '',
      siteNotes: 'WHS notes.',
    },
    bfd: {
      answers: { floorsAboveGround: '4', basementLevels: '1', gponPremises: '22', businessP2p: '2', fibreTv: 'no', fdtLikely: 'no' },
      selection: {
        code: 'BUDI-1S',
        name: 'Medium building fibre device',
        spec: '12F FSL',
        rationale: 'BUDI-1S',
        figure: 'Figure 4',
        savedAt: stamp,
      },
    },
    external: { items: items(EXTERNAL_QUESTIONS, 'ext'), siteNotes: 'External notes.' },
    internal: {
      floors,
      building: items(BUILDING_ITEMS, 'bldg'),
      buildingConfirmed: true,
      siteNotes: 'Internal notes.',
      byFloor: Object.fromEntries(
        floors.map((floor) => [
          floor.code,
          {
            checklist: items(FLOOR_ITEMS, floor.code),
            basement: floor.kind === 'basement' ? items(BASEMENT_ITEMS, floor.code) : {},
            unitSeq: 1,
            units: [
              {
                id: `unit-${floor.code}`,
                label: `${floor.code}-01`,
                completed: true,
                items: items(UNIT_ITEMS, `${floor.code}-u`),
              },
            ],
          },
        ]),
      ),
    },
    floorPlans: {
      siteNotes: 'Plan notes.',
      byFloor: Object.fromEntries(
        floors.map((floor) => [
          floor.code,
          {
            media: [media(`plan-${floor.code}`)],
            calibration: { pointA: [0.1, 0.1], pointB: [0.5, 0.1], distanceM: '10', imageAspect: 1 },
            devices: [],
            notes: '',
            reviewed: true,
            ready: true,
          },
        ]),
      ),
    },
    nbnDesign: {
      site: { mduSolution: 'MT-LFN' },
      design: { pitPipe: 'Yes', cabling: 'PIC direct', notes: 'Design notes.' },
      siteNotes: 'NBN notes.',
    },
    bom: { rows: Object.fromEntries(MOCK_BOM_ROWS.map((row) => [row.id, { confirmed: true }])) },
    preflight: {},
    signoff: { declaration: false },
  };
}

/** Stores the complete survey as unsynced drafts for `jobRef` (Dexie), so the runbook opens fully valid. */
export async function seedCompleteSurvey(jobRef: string): Promise<void> {
  const sections = completeSections();
  const stored: SectionKey[] = ['whs', 'bfd', 'external', 'internal', 'floorPlans', 'nbnDesign', 'bom', 'signoff'];
  const completed = new Set<SectionKey>(['whs', 'bfd', 'external', 'internal', 'floorPlans', 'nbnDesign', 'bom']);
  await getDb().runbookDrafts.bulkPut(
    stored.map((key) => ({
      id: `${jobRef}:${key}`,
      jobRef,
      key,
      data: sections[key],
      completed: completed.has(key),
      baseRev: 0,
      serverCompleted: false,
      dirty: true,
      updatedAt: new Date().toISOString(),
    })),
  );
}
