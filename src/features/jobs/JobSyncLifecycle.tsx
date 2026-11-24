import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { syncPendingJobs } from './jobSync';

export function JobSyncLifecycle() {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.userId);
  const role = useAppSelector((state) => state.auth.role);

  useEffect(() => {
    const sync = () => { void dispatch(syncPendingJobs()); };
    const visible = () => { if (document.visibilityState === 'visible') sync(); };
    sync();
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(sync, 2_000);
    return () => {
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', visible);
      window.clearInterval(timer);
    };
  }, [dispatch, userId, role]);
  return null;
}
