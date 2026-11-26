// Mock of GET /api/surveyor/config/runbook. Section order and copy come from the Figma Survey Runbook frames.

import type { RunbookConfig } from '@/types/surveyor';

export const MOCK_RUNBOOK_CONFIG: RunbookConfig = {
  version: '2026.10.1',
  sections: [
    { key: 'whs', order: 1, title: 'WHS Check', subtitle: 'Safety, access and site hazards.' },
    { key: 'bfd', order: 2, title: 'BFD Selection Wizard', subtitle: 'Six answers · recommended equipment.' },
    {
      key: 'external',
      order: 3,
      title: 'External Network & Site Entry',
      subtitle: 'Letterboxes, lead-in pit and building entry.',
    },
    { key: 'internal', order: 4, title: 'Internal Network', subtitle: 'Location, clearances and existing capacity.' },
    {
      key: 'floorPlans',
      order: 5,
      title: 'Floor Plans, Equipment Blocks & Calibration',
      subtitle: 'Capture plans, calibrate and review equipment.',
    },
    { key: 'nbnDesign', order: 6, title: 'NBN Design Inputs', subtitle: 'Site details and network design inputs.' },
    { key: 'bom', order: 7, title: 'BoM Review & Confirm', subtitle: 'Review network design and equipment inputs.' },
    {
      key: 'preflight',
      order: 8,
      title: 'Pre-flight Validation',
      subtitle: 'Resolve outstanding checks and evidence.',
    },
    {
      key: 'signoff',
      order: 9,
      title: 'Surveyor Sign-off & Submit',
      subtitle: 'Review, sign off and submit the site survey.',
    },
  ],
};
