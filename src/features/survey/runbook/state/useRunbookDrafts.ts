import { useEffect, useState } from 'react';
import type { RunbookDraftRecord } from '@/data/db/schema';
import { runbookRepo } from '@/data/repos/runbookRepo';

/** Loads this job's local drafts once (undefined while loading). Drafts newer than the server win on load. */
export function useRunbookDrafts(jobRef: string): RunbookDraftRecord[] | undefined {
  const [loaded, setLoaded] = useState<{ jobRef: string; drafts: RunbookDraftRecord[] }>();

  useEffect(() => {
    let cancelled = false;
    runbookRepo
      .forJob(jobRef)
      .catch(() => [] as RunbookDraftRecord[])
      .then((drafts) => {
        if (!cancelled) setLoaded({ jobRef, drafts });
      });
    return () => {
      cancelled = true;
    };
  }, [jobRef]);

  return loaded?.jobRef === jobRef ? loaded.drafts : undefined;
}
