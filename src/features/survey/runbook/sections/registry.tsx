import type { ComponentType } from 'react';
import type { SectionKey } from '@/types/surveyor';
import { BfdSection } from './bfd/BfdSection';
import { BomSection } from './bom/BomSection';
import { ExternalSection } from './external/ExternalSection';
import { FloorPlansSection } from './floorplans/FloorPlansSection';
import { InternalSection } from './internal/InternalSection';
import { NbnSection } from './nbn/NbnSection';
import { PreflightSection } from './preflight/PreflightSection';
import { SignoffSection } from './signoff/SignoffSection';
import { WhsSection } from './whs/WhsSection';

/** Section key -> the component rendered in the accordion body. Each section is its own component. */
export const SECTION_COMPONENTS: Record<SectionKey, ComponentType> = {
  whs: WhsSection,
  bfd: BfdSection,
  external: ExternalSection,
  internal: InternalSection,
  floorPlans: FloorPlansSection,
  nbnDesign: NbnSection,
  bom: BomSection,
  preflight: PreflightSection,
  signoff: SignoffSection,
};
