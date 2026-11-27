// Mock fixtures shaped like the Surveyor API responses (docs/surveyor-api-contract.md §2).
// Job refs are unique on purpose; the Figma file reuses MDU001 for two jobs, which is a design error.

import type { GetSurveyorJobsResponse, SiteInfo, SurveyorJobDetail, SurveyorJobSummary } from '@/types/surveyor';

export const MOCK_SURVEYOR = { userId: 'mock-surveyor-1', name: 'Alex Morgan' } as const;

// Built from local time so the "Synced 09:41" badge reads the same in every timezone.
const SYNCED_AT = new Date(2026, 9, 1, 9, 41).toISOString();

export const MOCK_JOBS: SurveyorJobSummary[] = [
  {
    jobRef: 'MDU-000001',
    siteName: 'Block A',
    address: '12–18 Bourke Street, Melbourne VIC',
    status: 'in_progress',
    scheduledDate: '2026-10-01',
    progress: { percent: 35, currentStep: 'Floor Survey' },
    sync: { state: 'synced', lastSyncedAt: SYNCED_AT },
    returned: null,
  },
  {
    jobRef: 'MDU-000002',
    siteName: '10 Smith Apartments',
    address: '10 Smith Street, Melbourne VIC',
    status: 'in_progress',
    scheduledDate: '2026-10-01',
    progress: { percent: 35, currentStep: 'Floor Survey' },
    sync: { state: 'synced', lastSyncedAt: SYNCED_AT },
    returned: null,
  },
  {
    jobRef: 'MDU-000004',
    siteName: 'Parkside Residences',
    address: '42 Lansdowne Street, East Melbourne VIC',
    status: 'not_started',
    scheduledDate: '2026-10-02',
    progress: null,
    sync: { state: 'synced', lastSyncedAt: SYNCED_AT },
    returned: null,
  },
  {
    jobRef: 'MDU-000005',
    siteName: 'Northbank Apartments',
    address: '560 Flinders Street, Melbourne VIC',
    status: 'returned',
    scheduledDate: '2026-10-01',
    progress: null,
    sync: { state: 'synced', lastSyncedAt: SYNCED_AT },
    returned: {
      reason: 'Level 3 floor plan needs calibration and BFD front clearance is missing.',
      returnedAt: '2026-10-01T00:00:00.000Z',
      dataRetained: true,
    },
  },
];

/** Jobs whose survey has been started during this session (mock persistence). */
export const startedJobRefs = new Set<string>();
/** Jobs whose site location was confirmed during this session (mock persistence). */
export const confirmedLocationRefs = new Set<string>();
/** Jobs submitted during this session (mock persistence). */
export const submittedJobRefs = new Set<string>();

function withSessionState(job: SurveyorJobSummary): SurveyorJobSummary {
  if (submittedJobRefs.has(job.jobRef)) return { ...job, status: 'submitted', progress: null };
  if (job.status === 'not_started' && startedJobRefs.has(job.jobRef)) {
    return { ...job, status: 'in_progress', progress: { percent: 0, currentStep: 'WHS Check' } };
  }
  return job;
}

export function mockJobsResponse(status?: string | null): GetSurveyorJobsResponse {
  const all = MOCK_JOBS.map(withSessionState);
  const jobs = status ? all.filter((job) => job.status === status) : all;
  return { assignedTo: { ...MOCK_SURVEYOR }, jobs };
}

export function mockJobDetail(jobRef: string): SurveyorJobDetail | undefined {
  const base = MOCK_JOBS.find((entry) => entry.jobRef === jobRef);
  if (!base) return undefined;
  const job = withSessionState(base);
  return {
    jobRef: job.jobRef,
    siteName: job.siteName,
    address: `${job.address} 3000`,
    status: job.status,
    scheduledDate: job.scheduledDate,
    assignedTo: MOCK_SURVEYOR.name,
    location: {
      latitude: -37.8121,
      longitude: 144.9727,
      confirmed: confirmedLocationRefs.has(job.jobRef),
      accuracyM: 5,
    },
    sync: job.sync,
    returned: job.returned,
    surveyStarted: job.status !== 'not_started',
  };
}

export const MOCK_SITE_INFO_OPTIONS = {
  parking: ['Yes · B1 visitor', 'Yes · Street only', 'No parking', 'Unknown'],
  buildingType: ['Vertical', 'Horizontal'],
  ground: ['Greenfield', 'Brownfield'],
};

export function mockSiteInfo(): SiteInfo {
  return {
    stakeholder: {
      role: { value: 'Building manager', fromManager: true },
      name: { value: 'Ella Brown', fromManager: true },
      phone: { value: '0412 680 144', fromManager: true },
      email: { value: 'ella.brown@blocka.com.au' },
    },
    access: {
      parking: 'Yes · B1 visitor',
      accessWindow: '09:00–16:00',
      entryInstructions: { value: 'Bourke Street lobby; sign in with concierge.', fromManager: true },
      accessRequirements: 'Collect riser key from Ella. Escort to plant room.',
    },
    building: { name: 'Harbour Mews', type: 'Vertical', ground: 'Brownfield' },
    rev: 1,
  };
}
