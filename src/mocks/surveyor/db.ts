// In-memory mock backend state. Lives for the page session only; Dexie remains the offline source of truth.

import type { Runbook, RunbookSectionRecord, SiteInfo } from '@/types/surveyor';
import { MOCK_RUNBOOK_CONFIG } from './runbookConfig';
import { seedSections } from './seedRunbook';
import { confirmedLocationRefs, mockJobDetail, mockSiteInfo, startedJobRefs, submittedJobRefs } from './jobs';

const runbooks = new Map<string, Runbook>();
const siteInfos = new Map<string, SiteInfo>();
const seenRequests = new Map<string, unknown>();

export function setSiteInfo(jobRef: string, info: SiteInfo): void {
  siteInfos.set(jobRef, info);
}

export function getOrCreateSiteInfo(jobRef: string): SiteInfo | undefined {
  if (!mockJobDetail(jobRef)) return undefined;
  let info = siteInfos.get(jobRef);
  if (!info) {
    info = mockSiteInfo();
    siteInfos.set(jobRef, info);
  }
  return info;
}

export function getOrCreateRunbook(jobRef: string): Runbook | undefined {
  const existing = runbooks.get(jobRef);
  if (existing) return existing;
  const job = mockJobDetail(jobRef);
  if (!job) return undefined;
  // The in-progress demo job opens in the state drawn in Figma; every other job starts blank.
  const seeded = job.status === 'in_progress' && jobRef === 'MDU-000001' ? seedSections(jobRef) : [];
  const sections: RunbookSectionRecord[] = MOCK_RUNBOOK_CONFIG.sections.map(
    (def) => seeded.find((entry) => entry.key === def.key) ?? { key: def.key, rev: 0, completed: false, data: {} },
  );
  const created: Runbook = { jobRef, title: job.siteName, rev: 0, sections };
  runbooks.set(jobRef, created);
  return created;
}

/** Idempotency: a replayed clientRequestId returns the original response. */
export function remember<T>(clientRequestId: string, compute: () => T): T {
  if (seenRequests.has(clientRequestId)) return seenRequests.get(clientRequestId) as T;
  const result = compute();
  seenRequests.set(clientRequestId, result);
  return result;
}

export function resetMockDb(): void {
  runbooks.clear();
  siteInfos.clear();
  seenRequests.clear();
  startedJobRefs.clear();
  confirmedLocationRefs.clear();
  submittedJobRefs.clear();
}
