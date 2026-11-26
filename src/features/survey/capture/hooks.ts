import { useEffect, useState } from 'react';
import { mediaRepo } from '@/data/repos/mediaRepo';

/** Object URL for a Blob, revoked on change/unmount (Blobs never go in Redux). */
export function useObjectUrl(blob: Blob | null | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return undefined;
    const next = URL.createObjectURL(blob);
    // Syncing React state with an external resource (object URL lifecycle) is the intended use of an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
      setUrl(undefined);
    };
  }, [blob]);
  return url;
}

/** Loads the display blob for a stored media item (marked-up copy if present, else the original). */
export function useMediaBlob(mediaId: string, version?: unknown): { blob: Blob | undefined; kind?: 'photo' | 'video' } {
  const [state, setState] = useState<{ id: string; version: unknown; blob?: Blob; kind?: 'photo' | 'video' }>();
  useEffect(() => {
    let cancelled = false;
    void mediaRepo.get(mediaId).then((record) => {
      if (cancelled || !record) return;
      setState({ id: mediaId, version, blob: record.markedBlob ?? record.originalBlob, kind: record.kind });
    });
    return () => {
      cancelled = true;
    };
  }, [mediaId, version]);
  return state?.id === mediaId ? { blob: state.blob, kind: state.kind } : { blob: undefined };
}
