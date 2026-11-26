// WHS Check questions, read from the Figma Survey Runbook frame (556:22616). Every question also gets a
// "Log location / details" box (project rule); hazard questions flag when answered Yes.

import type { YesNoNa } from '../model/types';

export interface WhsQuestion {
  code: string;
  label: string;
  options: YesNoNa[];
  /** Answering Yes logs the hazard into the WHS notes and requires details. */
  hazard?: boolean;
}

const YN: YesNoNa[] = ['yes', 'no'];
const YNN: YesNoNa[] = ['yes', 'no', 'na'];

export const WHS_QUESTIONS: WhsQuestion[] = [
  { code: 'whs.ppe', label: 'PPE confirmed (high-vis, safety boots, hard hat where required)', options: YN },
  { code: 'whs.induction', label: 'Site induction completed, or confirmed not required', options: YNN },
  { code: 'whs.confinedSpaceId', label: 'Confined space identified (basement pits, sealed risers)', options: YNN, hazard: true },
  { code: 'whs.asbestosRegister', label: 'Asbestos Register available?', options: YNN },
  { code: 'whs.asbestosPits', label: 'Potential for exposure to asbestos pits?', options: YNN, hazard: true },
  { code: 'whs.siteAccess', label: 'Site access confirmed with building contact', options: YN },
  { code: 'whs.ledLight', label: 'Portable LED work light available (required for basement / riser plan capture)', options: YN },
  { code: 'whs.heights', label: 'Potential for work at heights (>3.5m, stairwells, etc)?', options: YNN, hazard: true },
  { code: 'whs.confinedEntry', label: 'Potential for entry to confined spaces?', options: YNN, hazard: true },
  { code: 'whs.electrical', label: 'Potential for access to electrical risers / rooms?', options: YNN, hazard: true },
  { code: 'whs.fireWalls', label: 'Potential for penetration of fire-walls / floors?', options: YNN, hazard: true },
  { code: 'whs.trenching', label: 'Potential for trenching?', options: YNN },
  { code: 'whs.epr', label: 'Potential for LV, HV / Earth Potential Rise (EPR) hazard assessment?', options: YNN, hazard: true },
];

export const WHS_OPTION_LABEL: Record<YesNoNa, string> = { yes: 'Yes', no: 'No', na: 'N/A' };
