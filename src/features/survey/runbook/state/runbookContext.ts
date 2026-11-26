import { createContext, useContext } from 'react';
import type { SectionKey } from '@/types/surveyor';
import type { Issue, RunbookModel, SectionDataMap } from '../model/types';
import type { Progress, SummaryMap } from '../logic';

export interface RunbookContextValue {
  jobRef: string;
  surveyorName: string;
  /** Everything the pure logic functions derive from. */
  model: RunbookModel;
  summaries: SummaryMap;
  issues: Issue[];
  progress: Progress;
  /** Sections whose latest edit has not reached the server yet. */
  pendingSections: number;
  /** Individual edits not yet accepted by the server ("4 changes pending sync"). */
  pendingChanges: number;
  online: boolean;
  /** True once the survey has been successfully submitted: sections become read-only. */
  readOnly: boolean;
  /** Sign off and submit (queued locally when offline; not "submitted" until the server accepts it). */
  submit: (signedAt: string) => Promise<void>;
  submitting: boolean;
  submitFailed: boolean;
  /** Replace one section's data. `recipe` must be pure (it may run twice in dev). */
  update: <K extends SectionKey>(key: K, recipe: (data: SectionDataMap[K]) => SectionDataMap[K]) => void;
  setCompleted: (key: SectionKey, value: boolean) => void;
  /** Expands a section and scrolls to it. */
  openSection: (key: SectionKey) => void;
}

export const RunbookContext = createContext<RunbookContextValue | null>(null);

export function useRunbook(): RunbookContextValue {
  const value = useContext(RunbookContext);
  if (!value) throw new Error('useRunbook must be used inside RunbookProvider');
  return value;
}
