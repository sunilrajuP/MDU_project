// Mock BFD recommendation and bill of materials.

import type { BomRow, RecommendBfdResponse } from '@/types/surveyor';

/**
 * [TBC] The real Figure 4 decision rules are not in the Figma cache. This mock follows the one worked example
 * in the design (22 premises, 2 business P2P locations, no Fibre TV or FDT => BUDI-1S) and falls back to BUDI-M.
 */
export function recommendBfd(answers: Record<string, string>): RecommendBfdResponse {
  const p2p = Number(answers.businessP2p ?? 0);
  if (p2p >= 2) {
    return {
      figure: 'Figure 4',
      recommendation: {
        code: 'BUDI-1S',
        name: 'Medium building fibre device',
        spec: '12F FSL · up to 200 GPON · multiple P2P',
        rationale: 'BUDI-1S — ≥2 potential business customers (Fig 4)',
      },
    };
  }
  return {
    figure: 'Figure 4',
    recommendation: {
      code: 'BUDI-M',
      name: 'Building fibre device',
      spec: '[TBC] specification',
      rationale: 'BUDI-M — fewer than 2 potential business customers (Fig 4) [TBC]',
    },
  };
}

/** The draft bill of materials exactly as drawn in the Figma BoM frame (15 rows). */
export const MOCK_BOM_ROWS: BomRow[] = [
  { id: 'bfd', item: 'BUDI-1S', description: 'BFD blocks on plans (recommended BUDI-1S)', quantity: 1, unit: 'ea', source: 'plan' },
  { id: 'sdt14', item: 'SDT 1:4', description: 'SDT 1:4 blocks on plans', quantity: 2, unit: 'ea', source: 'plan' },
  { id: 'sdt18', item: 'SDT 1:8', description: 'SDT 1:8 blocks on plans', quantity: 0, unit: 'ea', source: 'plan' },
  { id: 'icd', item: 'ICD', description: 'ICD blocks on plans', quantity: 2, unit: 'ea', source: 'plan' },
  { id: 'ntd', item: 'NTD', description: '1 per premises (EUP count, letterbox-confirmed)', quantity: 22, unit: 'ea', source: 'calculated' },
  { id: 'sds', item: '1F SDS cable', description: 'Pit-to-building lead-in run (Group 1)', quantity: 6, unit: 'Lm', source: 'manual' },
  { id: 'pmc', item: '1F PMC cable', description: 'PCD to each SDT via riser (riser distance × SDT count)', quantity: 32, unit: 'Lm', source: 'calculated' },
  { id: 'pic', item: '1F PIC cable', description: 'SDT–NTD distances (Group 4) × EUPs per floor', quantity: 402, unit: 'Lm', source: 'calculated' },
  { id: 'conduitH', item: 'Conduit (internal, horizontal)', description: 'Plan dimensions tagged "conduit"', quantity: 16, unit: 'Lm', source: 'plan' },
  { id: 'conduitV', item: 'Conduit (riser / vertical)', description: 'Riser schedule entry (Group 3)', quantity: 16, unit: 'Lm', source: 'manual' },
  { id: 'tray', item: 'Cable tray', description: 'Plan dimensions tagged "tray"', quantity: 12, unit: 'Lm', source: 'plan' },
  { id: 'seal', item: 'Fire penetration seal', description: 'Fire-seal blocks on plans', quantity: 1, unit: 'ea', source: 'plan' },
  { id: 'catenary', item: 'Catenary wire', description: 'Plan dimensions tagged "catenary"', quantity: 8, unit: 'Lm', source: 'plan' },
  { id: 'gpo', item: 'GPO upgrade', description: '1 per NTD (EUP count)', quantity: 22, unit: 'ea', source: 'calculated' },
  {
    id: 'fittings',
    item: 'Conduit fittings (bends / joins)',
    description: 'Estimated by designer',
    quantity: 0,
    unit: 'ea',
    source: 'manual',
    flag: 'Missing fittings · Review required',
  },
];
