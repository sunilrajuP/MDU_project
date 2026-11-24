import { useEffect, useState, type PropsWithChildren } from 'react';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { useAppDispatch } from '@/store/hooks';
import { runHydrators } from '@/data/hydration/registry';
import { JobSyncLifecycle } from '@/features/jobs/JobSyncLifecycle';

function Bootstrap({ children }: Readonly<PropsWithChildren>) {
  const dispatch = useAppDispatch();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    runHydrators(dispatch).then(() => setReady(true)).catch((failure: unknown) => {
      setError(failure instanceof Error ? failure.message : 'Local data could not be loaded.');
    });
  }, [dispatch]);

  if (error) return <div role="alert">
    Could not load saved data: {error}. Close other tabs and retry. Do not clear site data.
    <button onClick={() => window.location.reload()}>Retry</button>
  </div>;
  if (!ready) return null;
  return <><JobSyncLifecycle />{children}</>;
}

export function AppProviders({ children }: Readonly<PropsWithChildren>) {
  return (
    <Provider store={store}>
      <Bootstrap>{children}</Bootstrap>
    </Provider>
  );
}
