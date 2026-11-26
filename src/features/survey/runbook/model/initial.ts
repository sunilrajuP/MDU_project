import type { RunbookDraftRecord } from '@/data/db/schema';
import type { Runbook, SectionKey } from '@/types/surveyor';
import { SECTION_ORDER, defaultSectionData, mergeSection } from './defaults';
import type { SectionDataMap } from './types';

export interface InitialRunbook {
  data: SectionDataMap;
  completed: Record<SectionKey, boolean>;
  /** Last server revision per section (base for the next save). */
  revs: Record<SectionKey, number>;
  /** The server already knows the section is complete. */
  serverCompleted: Record<SectionKey, boolean>;
  /** Sections whose local draft has not reached the server. */
  dirty: Record<SectionKey, boolean>;
}

const record = <T,>(fill: (key: SectionKey) => T): Record<SectionKey, T> =>
  Object.fromEntries(SECTION_ORDER.map((key) => [key, fill(key)])) as Record<SectionKey, T>;

/**
 * Starting state = the server's saved sections, except where this device holds a draft that is at least as new:
 * an unsynced draft (edited offline) always wins, and a synced draft wins unless the server has since moved
 * ahead of it (another device saved). Dexie is the source of truth while editing; the server catches up on flush.
 */
export function buildInitial(runbook: Runbook, drafts: RunbookDraftRecord[]): InitialRunbook {
  const data = defaultSectionData();
  const completed = record(() => false);
  const revs = record(() => 0);
  const serverCompleted = record(() => false);
  const dirty = record(() => false);

  for (const section of runbook.sections) {
    const key = section.key;
    Object.assign(data, { [key]: mergeSection(key, section.data) });
    completed[key] = section.completed;
    serverCompleted[key] = section.completed;
    revs[key] = section.rev;
  }

  for (const draft of drafts) {
    const key = draft.key;
    if (!draft.dirty && draft.baseRev < revs[key]) continue; // server is ahead of this synced copy
    Object.assign(data, { [key]: mergeSection(key, draft.data) });
    completed[key] = draft.completed;
    serverCompleted[key] = draft.serverCompleted;
    revs[key] = Math.max(draft.baseRev, revs[key]);
    dirty[key] = draft.dirty;
  }

  return { data, completed, revs, serverCompleted, dirty };
}
