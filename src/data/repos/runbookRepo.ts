import { getDb } from '../db/getDb';
import type { RunbookDraftRecord } from '../db/schema';
import type { SectionKey } from '@/types/surveyor';

export const draftId = (jobRef: string, key: SectionKey) => `${jobRef}:${key}`;

export const runbookRepo = {
  forJob(jobRef: string): Promise<RunbookDraftRecord[]> {
    return getDb().runbookDrafts.where('jobRef').equals(jobRef).toArray();
  },

  put(record: RunbookDraftRecord): Promise<unknown> {
    return getDb().runbookDrafts.put(record);
  },

  async clearJob(jobRef: string): Promise<void> {
    await getDb().runbookDrafts.where('jobRef').equals(jobRef).delete();
  },
};
