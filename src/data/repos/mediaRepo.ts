import { getDb } from '../db/getDb';
import type { MediaRecord } from '../db/schema';
import type { MarkupData, MediaContext } from '@/types/surveyor';

export function mediaItemKey(context: MediaContext): string {
  return [context.sectionKey, context.itemCode, context.floorCode, context.unitId].filter(Boolean).join(':');
}

export const mediaRepo = {
  /** Persists a new capture. The original blob is written once and never modified afterwards. */
  async addOriginal(record: Omit<MediaRecord, 'itemKey' | 'syncStatus'>): Promise<MediaRecord> {
    const full: MediaRecord = { ...record, itemKey: mediaItemKey(record.context), syncStatus: 'pending' };
    await getDb().media.add(full);
    return full;
  },

  get(id: string): Promise<MediaRecord | undefined> {
    return getDb().media.get(id);
  },

  forItem(jobRef: string, context: MediaContext): Promise<MediaRecord[]> {
    return getDb().media.where('[jobRef+itemKey]').equals([jobRef, mediaItemKey(context)]).toArray();
  },

  /** Adds (or replaces) the marked-up copy and vector markup. The original is left untouched. */
  async saveMarkup(id: string, markedBlob: Blob, markup: MarkupData): Promise<void> {
    await getDb().media.update(id, { markedBlob, markup, syncStatus: 'pending' });
  },

  async markSynced(id: string): Promise<void> {
    await getDb().media.update(id, { syncStatus: 'synced' });
  },

  async markFailed(id: string): Promise<void> {
    await getDb().media.update(id, { syncStatus: 'failed' });
  },

  async remove(id: string): Promise<void> {
    await getDb().media.delete(id);
  },
};
