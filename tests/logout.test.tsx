import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/api/baseApi';
import { db } from '@/data/db/schema';
import { runHydrators } from '@/data/hydration/registry';
import { authRepo } from '@/data/repos/authRepo';
import authReducer from '@/features/auth/authSlice';
import { LoginPage } from '@/features/auth/LoginPage';
import jobsReducer from '@/features/jobs/jobsSlice';
import { ManagerLayout } from '@/features/manager/ManagerLayout';
import teamReducer from '@/features/teamlead/teamSlice';
import type { Role } from '@/types/domain';

function makeStore() {
  return configureStore({
    reducer: { auth: authReducer, jobs: jobsReducer, team: teamReducer, api: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

const session = {
  userId: '1', name: 'Test User', role: 'Manager' as Role,
  accessToken: 'access-token', refreshToken: 'refresh-token', expiry: '2099-01-01',
};
let store: ReturnType<typeof makeStore>;
let router: ReturnType<typeof createMemoryRouter>;

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  store = makeStore();
});

afterEach(() => {
  router?.dispose();
  store.dispatch(baseApi.util.resetApiState());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderLayout(role: 'Manager' | 'TeamLead', refreshToken: string | null = session.refreshToken) {
  await authRepo.set({ ...session, role, refreshToken });
  await runHydrators(store.dispatch);
  router = createMemoryRouter([
    { path: '/dashboard', element: <ManagerLayout /> },
    { path: '/login', element: <LoginPage /> },
  ], { initialEntries: ['/dashboard'] });
  render(<Provider store={store}><RouterProvider router={router} /></Provider>);
}

describe('management sign out', () => {
  it.each([
    ['Manager', 'sidebar'],
    ['Manager', 'account'],
    ['TeamLead', 'sidebar'],
    ['TeamLead', 'account'],
  ] as const)('calls logout and clears the %s session from the %s action', async (role, action) => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await renderLayout(role);
    if (action === 'account') {
      fireEvent.click(screen.getByRole('button', { name: 'Account for Test User' }));
      fireEvent.click(within(screen.getByRole('region', { name: 'Account details' }))
        .getByRole('button', { name: 'Sign Out' }));
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    }

    await screen.findByRole('button', { name: 'Sign In' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/logout');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ refreshToken: session.refreshToken });
    expect(await authRepo.get()).toBeUndefined();
    expect(store.getState().auth.userId).toBeNull();
    const fresh = makeStore();
    await runHydrators(fresh.dispatch);
    expect(fresh.getState().auth.userId).toBeNull();
    fresh.dispatch(baseApi.util.resetApiState());
  });

  it.each(['server', 'network', 'missing token'])(
    'signs out locally and warns when revocation fails: %s', async (failure) => {
      const fetchMock = vi.fn(async () => {
        if (failure === 'network') throw new TypeError('Offline');
        return Response.json({ message: 'Rejected' }, { status: 500 });
      });
      vi.stubGlobal('fetch', fetchMock);
      await renderLayout('Manager', failure === 'missing token' ? null : session.refreshToken);
      fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
      expect((await screen.findByRole('alert')).textContent).toContain('server session could not be revoked');
      expect(await authRepo.get()).toBeUndefined();
      expect(store.getState().auth.userId).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(failure === 'missing token' ? 0 : 1);
    },
  );

  it('does not clear a different session established while logout is pending', async () => {
    let finish!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => { finish = resolve; });
    const fetchMock = vi.fn(() => response);
    vi.stubGlobal('fetch', fetchMock);
    await renderLayout('TeamLead');
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const next = { ...session, userId: '2', refreshToken: 'new-refresh' };
    await authRepo.set(next);
    await runHydrators(store.dispatch);
    finish(new Response(null, { status: 200 }));
    expect((await screen.findByRole('alert')).textContent).toContain('session changed');
    expect(await authRepo.get()).toMatchObject(next);
    expect(store.getState().auth.userId).toBe('2');
  });

  it('prevents duplicate logout requests while sign-out is pending', async () => {
    let finish!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => { finish = resolve; });
    const fetchMock = vi.fn(() => response);
    vi.stubGlobal('fetch', fetchMock);
    await renderLayout('Manager');
    const button = screen.getByRole('button', { name: 'Sign Out' });
    fireEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledOnce();
    finish(new Response(null, { status: 200 }));
    await screen.findByRole('button', { name: 'Sign In' });
  });

  it('reports storage failure without claiming sign-out succeeded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));
    await renderLayout('Manager');
    vi.spyOn(authRepo, 'replaceIfCurrent').mockRejectedValue(new Error('Storage unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to clear the saved session');
    expect(store.getState().auth.userId).toBe(session.userId);
  });
});
