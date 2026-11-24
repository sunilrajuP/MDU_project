import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/api/baseApi';
import { RequireAuth } from '@/app/guards';
import { db } from '@/data/db/schema';
import { runHydrators } from '@/data/hydration/registry';
import { authRepo } from '@/data/repos/authRepo';
import authReducer, { loggedOut } from '@/features/auth/authSlice';
import jobsReducer from '@/features/jobs/jobsSlice';
import teamReducer from '@/features/teamlead/teamSlice';

function makeStore() {
  return configureStore({
    reducer: { auth: authReducer, jobs: jobsReducer, team: teamReducer, api: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

function jwt(exp = Math.floor(Date.now() / 1000) + 3600) {
  return `header.${btoa(JSON.stringify({ sub: '1', name: 'Manager', role: 'MANAGER', exp }))}.signature`;
}

const session = {
  userId: '1', name: 'Manager', role: 'Manager' as const,
  accessToken: 'old-token', refreshToken: 'refresh-token', expiry: '2099-01-01T00:00:00Z',
};
let store: ReturnType<typeof makeStore>;
let stores: ReturnType<typeof makeStore>[];
const request = (id = '1') => store.dispatch(baseApi.endpoints.getSurveySession.initiate(id));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await authRepo.set(session);
  store = makeStore();
  stores = [store];
  await runHydrators(store.dispatch);
});

afterEach(() => {
  for (const item of stores) item.dispatch(baseApi.util.resetApiState());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('authentication refresh', () => {
  it('persists all login token fields and hydrates a fresh store', async () => {
    const response = { accessToken: jwt(), refreshToken: 'login-refresh', expiry: session.expiry };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(response)));
    await store.dispatch(baseApi.endpoints.login.initiate({ email: 'user@example.test', password: 'password' })).unwrap();
    expect(await authRepo.get()).toMatchObject(response);
    expect(store.getState().auth).toMatchObject(response);
    const fresh = makeStore();
    stores.push(fresh);
    await runHydrators(fresh.dispatch);
    expect(fresh.getState().auth).toEqual(store.getState().auth);
  });

  it('refreshes expired tokens before sending the protected request and persists rotation', async () => {
    await authRepo.set({ ...session, expiry: '2000-01-01' });
    const tokens = { accessToken: jwt(), refreshToken: 'rotated', expiry: '2099-02-01T00:00:00.000Z' };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/auth/refresh') {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: session.refreshToken });
        expect(new Headers(init?.headers).has('Authorization')).toBe(false);
        return Response.json(tokens);
      }
      expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${tokens.accessToken}`);
      return Response.json({ jobId: '1' });
    });
    vi.stubGlobal('fetch', fetchMock);
    await request().unwrap();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/auth/refresh', '/api/1/survey']);
    expect(await authRepo.get()).toMatchObject(tokens);
    expect(store.getState().auth).toMatchObject(tokens);
    const fresh = makeStore();
    stores.push(fresh);
    await runHydrators(fresh.dispatch);
    expect(fresh.getState().auth).toEqual(store.getState().auth);
  });

  it('shares refresh for concurrent 401s, including a late old-token 401', async () => {
    const refresh = deferred<Response>();
    const started = deferred<void>();
    const late = deferred<Response>();
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const newToken = jwt(exp);
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/auth/refresh') {
        refreshCalls++;
        started.resolve();
        return refresh.promise;
      }
      const token = new Headers(init?.headers).get('Authorization');
      if (token === `Bearer ${session.accessToken}`) {
        if (url === '/api/3/survey') return late.promise;
        return Response.json({}, { status: 401 });
      }
      expect(token).toBe(`Bearer ${newToken}`);
      return Response.json({ jobId: url });
    });
    vi.stubGlobal('fetch', fetchMock);
    const requests = [request('1'), request('2'), request('3')];
    await started.promise;
    refresh.resolve(Response.json({ accessToken: newToken }));
    await Promise.all(requests.slice(0, 2).map((item) => item.unwrap()));
    late.resolve(Response.json({}, { status: 401 }));
    await requests[2].unwrap();
    expect(refreshCalls).toBe(1);
    const expectedExpiry = new Date(exp * 1000).toISOString();
    expect(await authRepo.get()).toMatchObject({ accessToken: newToken, refreshToken: session.refreshToken });
    expect(store.getState().auth.expiry).toBe(expectedExpiry);
  });

  it('shares pre-flight refresh for concurrent expired requests', async () => {
    await authRepo.set({ ...session, expiry: '2000-01-01' });
    const refresh = deferred<Response>();
    const started = deferred<void>();
    let refreshCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/auth/refresh') {
        refreshCalls++;
        started.resolve();
        return refresh.promise;
      }
      return Response.json({});
    }));
    const requests = [request('1'), request('2'), request('3')];
    await started.promise;
    refresh.resolve(Response.json({ accessToken: jwt() }));
    await Promise.all(requests.map((item) => item.unwrap()));
    expect(refreshCalls).toBe(1);
  });

  it.each(['unauthorized', 'network', 'malformed', 'expired', 'missing-expiry', 'server'])(
    'clears auth and redirects to login when refresh fails: %s', async (failure) => {
      render(<Provider store={store}><MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<RequireAuth><div>Protected page</div></RequireAuth>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter></Provider>);
      const fetchMock = vi.fn(async (url: string) => {
        if (url !== '/api/auth/refresh') return Response.json({}, { status: 401 });
        if (failure === 'network') throw new TypeError('Offline');
        if (failure === 'malformed') return Response.json({ accessToken: 42 });
        if (failure === 'expired') return Response.json({ accessToken: jwt(1) });
        if (failure === 'missing-expiry') return Response.json({ accessToken: 'opaque-token' });
        return Response.json({}, { status: failure === 'server' ? 500 : 401 });
      });
      vi.stubGlobal('fetch', fetchMock);
      await expect(request().unwrap()).rejects.toMatchObject({ status: 401 });
      expect(await screen.findByText('Login page')).toBeTruthy();
      expect(await authRepo.get()).toBeUndefined();
      expect(store.getState().auth).toMatchObject({
        userId: null, accessToken: null, refreshToken: null, expiry: null, hydrated: true,
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const fresh = makeStore();
      stores.push(fresh);
      await runHydrators(fresh.dispatch);
      expect(fresh.getState().auth.userId).toBeNull();
    },
  );

  it('does not refresh again when the retried request is unauthorized', async () => {
    const fetchMock = vi.fn(async (url: string) => url === '/api/auth/refresh'
      ? Response.json({ accessToken: jwt() }) : Response.json({}, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(request().unwrap()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/1/survey', '/api/auth/refresh', '/api/1/survey',
    ]);
    expect(await authRepo.get()).toBeUndefined();
  });

  it('does not refresh twice when the request sent after pre-flight refresh is unauthorized', async () => {
    await authRepo.set({ ...session, expiry: '2000-01-01' });
    const fetchMock = vi.fn(async (url: string) => url === '/api/auth/refresh'
      ? Response.json({ accessToken: jwt() }) : Response.json({}, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(request().unwrap()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/auth/refresh', '/api/1/survey']);
  });

  it('shares refresh failures without silently resolving concurrent requests', async () => {
    const refresh = deferred<Response>();
    const started = deferred<void>();
    let refreshCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url !== '/api/auth/refresh') return Response.json({}, { status: 401 });
      refreshCalls++;
      started.resolve();
      return refresh.promise;
    }));
    const pending = [request('1'), request('2'), request('3')];
    await started.promise;
    refresh.resolve(Response.json({}, { status: 401 }));
    const results = await Promise.allSettled(pending.map((item) => item.unwrap()));
    expect(results).toEqual([
      expect.objectContaining({ status: 'rejected', reason: expect.objectContaining({ status: 401 }) }),
      expect.objectContaining({ status: 'rejected', reason: expect.objectContaining({ status: 401 }) }),
      expect.objectContaining({ status: 'rejected', reason: expect.objectContaining({ status: 401 }) }),
    ]);
    expect(refreshCalls).toBe(1);
    expect(await authRepo.get()).toBeUndefined();
  });

  it('fails closed and reports an error if persisting refreshed tokens fails', async () => {
    const replace = authRepo.replaceIfCurrent;
    vi.spyOn(authRepo, 'replaceIfCurrent').mockImplementation((expected, next) => {
      if (next) return Promise.reject(new Error('Storage unavailable'));
      return replace(expected, next);
    });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/api/auth/refresh'
      ? Response.json({ accessToken: jwt() }) : Response.json({}, { status: 401 })));
    await expect(request().unwrap()).rejects.toMatchObject({
      status: 500, message: 'Unable to save the refreshed session. Please sign in again.',
    });
    expect(await authRepo.get()).toBeUndefined();
    expect(store.getState().auth.userId).toBeNull();
  });

  it('detects expiry using JWT exp for legacy sessions without an expiry field', async () => {
    await authRepo.set({ ...session, accessToken: jwt(1), expiry: null });
    const fetchMock = vi.fn(async (url: string) => url === '/api/auth/refresh'
      ? Response.json({ accessToken: jwt() }) : Response.json({}));
    vi.stubGlobal('fetch', fetchMock);
    await request().unwrap();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/refresh');
  });

  it('keeps legacy sessions usable, but signs out on 401 without a refresh token', async () => {
    await authRepo.set({ ...session, refreshToken: null, expiry: null });
    const fetchMock = vi.fn(async () => Response.json({}, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(request().unwrap()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await authRepo.get()).toBeUndefined();
  });

  it('does not resurrect a logged-out session while refresh is in flight', async () => {
    const refresh = deferred<Response>();
    const started = deferred<void>();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url !== '/api/auth/refresh') return Response.json({}, { status: 401 });
      started.resolve();
      return refresh.promise;
    }));
    const pending = request();
    await started.promise;
    await authRepo.clear();
    store.dispatch(loggedOut());
    refresh.resolve(Response.json({ accessToken: jwt() }));
    await expect(pending.unwrap()).rejects.toMatchObject({ status: 401 });
    expect(await authRepo.get()).toBeUndefined();
    expect(store.getState().auth.userId).toBeNull();
  });

  it('does not overwrite a different login when an old refresh fails', async () => {
    const refresh = deferred<Response>();
    const started = deferred<void>();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url !== '/api/auth/refresh') return Response.json({}, { status: 401 });
      started.resolve();
      return refresh.promise;
    }));
    const pending = request();
    await started.promise;
    const next = { ...session, userId: '2', accessToken: 'another-login' };
    await authRepo.set(next);
    await runHydrators(store.dispatch);
    refresh.resolve(Response.json({}, { status: 401 }));
    await expect(pending.unwrap()).rejects.toMatchObject({ status: 401 });
    expect(await authRepo.get()).toMatchObject(next);
    expect(store.getState().auth.userId).toBe('2');
  });

  it.each([403, 500])('does not refresh or clear auth for HTTP %s', async (status) => {
    const fetchMock = vi.fn(async () => Response.json({ message: 'Request rejected' }, { status }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(request().unwrap()).rejects.toMatchObject({ status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await authRepo.get()).toMatchObject(session);
  });

  it('retries mutations with the original body and idempotency key', async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/auth/refresh') return Response.json({ accessToken: jwt() });
      calls.push(init!);
      if (calls.length === 1) return Response.json({}, { status: 401 });
      return Response.json({
        id: 1, siteName: 'Site', siteAddress: 'Address', status: 'YetToAssign', scheduledDate: null,
      });
    }));
    await store.dispatch(baseApi.endpoints.createJob.initiate({
      siteName: 'Site', siteAddress: 'Address', scheduledDate: '2026-12-01', createdDate: '2026-11-01',
      assignedSurveyorId: null, comments: '', clientRequestId: 'same-key',
    })).unwrap();
    expect(calls).toHaveLength(2);
    expect(calls[0].body).toBe(calls[1].body);
    for (const call of calls) {
      expect(new Headers(call.headers).get('Idempotency-Key')).toBe('same-key');
    }
  });
});
