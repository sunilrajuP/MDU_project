import type { SectionKey } from '@/types/surveyor';
import { DEFAULT_FLOORS } from '../config/internalConfig';
import type { FloorState, PlanState, SectionDataFor, SectionDataMap } from './types';

export const SECTION_ORDER: SectionKey[] = [
  'whs',
  'bfd',
  'external',
  'internal',
  'floorPlans',
  'nbnDesign',
  'bom',
  'preflight',
  'signoff',
];

export function defaultSectionData(): SectionDataMap {
  return {
    whs: { answers: {}, hazardNotes: '', siteNotes: '' },
    bfd: { answers: {}, selection: null },
    external: { items: {}, siteNotes: '' },
    internal: {
      floors: DEFAULT_FLOORS.map((floor) => ({ ...floor })),
      building: {},
      buildingConfirmed: false,
      byFloor: {},
      siteNotes: '',
    },
    floorPlans: { byFloor: {}, siteNotes: '' },
    nbnDesign: { site: {}, design: {}, siteNotes: '' },
    bom: { rows: {} },
    preflight: {},
    signoff: { declaration: false },
  };
}

/** Saved data wins over defaults key by key, so sections written by an older app version still load. */
export function mergeSection<K extends SectionKey>(key: K, stored: Record<string, unknown> | undefined): SectionDataFor<K> {
  return { ...defaultSectionData()[key], ...stored } as SectionDataFor<K>;
}

export const emptyFloor = (): FloorState => ({ checklist: {}, basement: {}, units: [], unitSeq: 0 });

export const emptyPlan = (): PlanState => ({
  media: [],
  calibration: null,
  devices: [],
  notes: '',
  reviewed: false,
  ready: false,
});
