import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/api/baseApi';
import { router } from '@/app/router';
import { roleHome } from '@/app/guards';
import { canAssign, canEditJob } from '@/config/rules/assignment';
import { db } from '@/data/db/schema';
import { runHydrators } from '@/data/hydration/registry';
import { authRepo } from '@/data/repos/authRepo';
import authReducer, { authHydrated } from '@/features/auth/authSlice';
import jobsReducer, { jobsHydrated } from '@/features/jobs/jobsSlice';
import { scopeJobsToActor } from '@/features/jobs/jobStatus';
import { assignJobLocalFirst, createJob, editJob } from '@/features/jobs/jobsThunks';
import teamReducer, { usersHydrated } from '@/features/teamlead/teamSlice';
import type { Job, Role } from '@/types/domain';

function makeStore() {
  return configureStore({
    reducer: { auth: authReducer, jobs: jobsReducer, team: teamReducer, api: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

const job: Job = {
  id: '21', siteName: 'Shared Site', address: '10 Main Street', status: 'new',
  createdBy: { userId: '1', role: 'Manager' }, siteDetails: {}, assignmentHistory: [],
  attempt: 0, updatedAt: '2026-11-01T00:00:00Z', dirty: false, syncStatus: 'synced',
};
let store: ReturnType<typeof makeStore>;
let requests: string[];
let claim: string | string[];
let pageRouter: ReturnType<typeof createMemoryRouter> | undefined;

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  store = makeStore();
  requests = [];
  claim = 'TEAM_LEAD';
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    requests.push(url);
    if (url === '/api/auth/login') {
      const payload = btoa(JSON.stringify({ sub: '7', name: 'Test User', role: claim }));
      return Response.json({ accessToken: `header.${payload}.signature`, refreshToken: null, expiry: '2099-01-01' });
    }
    expect(init?.headers).toHaveProperty('Authorization');
    if (url === '/api/users/team') {
      if ((await authRepo.get())?.role === 'Manager') {
        return Response.json([{ id: 8, displayName: 'Eligible Lead', email: 'lead@example.test', isActive: true }]);
      }
      return Response.json([
        { id: 9, displayName: 'Eligible Surveyor', email: 'surveyor@example.test', isActive: true },
        { id: 10, displayName: 'Inactive Surveyor', email: 'inactive@example.test', isActive: false },
      ]);
    }
    if (url === '/api/jobs') {
      return Response.json([{
        id: 21, siteName: job.siteName, siteAddress: job.address, jobRef: 'MDU-21', status: 'Submitted',
      }]);
    }
    if (url === '/api/job/create_job') {
      return Response.json({
        ...JSON.parse(String(init?.body)), id: 22, jobRef: 'MDU-22', status: 'YetToAssign',
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }));
});

afterEach(() => {
  pageRouter?.dispose();
  pageRouter = undefined;
  store.dispatch(baseApi.util.resetApiState());
  vi.unstubAllGlobals();
});

function renderRoute(path: string) {
  pageRouter = createMemoryRouter(router.routes, { initialEntries: [path] });
  render(<Provider store={store}><RouterProvider router={pageRouter} /></Provider>);
}

async function signInAs(role: Role) {
  const session = { userId: '7', name: 'Test User', role, accessToken: 'test-token' };
  await authRepo.set(session);
  store.dispatch(authHydrated(session));
  store.dispatch(jobsHydrated([]));
}

describe('role login and roster selection', () => {
  it.each([
    ['TEAM_LEAD', 'TeamLead'],
    ['TEAMLEAD', 'TeamLead'],
    ['Team Lead', 'TeamLead'],
    [['TEAM_LEAD'], 'TeamLead'],
    ['MANAGER', 'Manager'],
    ['ADMIN', 'Manager'],
    ['SURVEYOR', 'Surveyor'],
    ['QC', 'QC'],
    ['DESIGNER', 'Designer'],
  ] as const)('maps role %j and restores it after reload', async (value, role) => {
    claim = typeof value === 'string' ? value : [...value];
    const result = await store.dispatch(baseApi.endpoints.login.initiate({
      email: 'user@example.test', password: 'test-password',
    })).unwrap();
    expect(result.role).toBe(role);
    await waitFor(async () => expect((await authRepo.get())?.role).toBe(role));
    const fresh = makeStore();
    await runHydrators(fresh.dispatch);
    expect(fresh.getState().auth.role).toBe(role);
    fresh.dispatch(baseApi.util.resetApiState());
  });

  it.each([
    ['MANAGER', '/dashboard', '/api/users/team'],
    ['TEAM_LEAD', '/dashboard', '/api/users/team'],
  ])('logs in %s and fetches only the appropriate roster', async (role, home, expected) => {
    claim = role;
    renderRoute('/login');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => expect(pageRouter?.state.location.pathname).toBe(home));
    await waitFor(() => expect(requests).toContain(expected));
  });

  it.each(['Manager', 'TeamLead'] as const)('uses the %s roster in create mode', async (role) => {
    await signInAs(role);
    renderRoute('/createJob');
    const target = role === 'Manager' ? 'Eligible Lead' : 'Eligible Surveyor';
    const dropdown = screen.getByRole('combobox', {
      name: role === 'Manager' ? 'Assign Team Lead · optional' : 'Assign Surveyor · optional',
    });
    await waitFor(() => expect((dropdown as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(dropdown);
    await screen.findByRole('option', { name: target });
    expect(requests.filter((request) => request === '/api/users/team')).toHaveLength(1);
    expect(screen.queryByRole('option', { name: 'Inactive Surveyor' })).toBeNull();
  });

  it('rejects unknown roles without persisting an authorized session', async () => {
    claim = 'UNSUPPORTED';
    await expect(store.dispatch(baseApi.endpoints.login.initiate({
      email: 'user@example.test', password: 'test-password',
    })).unwrap()).rejects.toEqual({ status: 500, message: 'Unrecognized role returned by the server.' });
    expect(await authRepo.get()).toBeUndefined();
  });

  it.each(['Manager', 'TeamLead'] as const)('persists the correct assignment role for %s-created jobs', async (role) => {
    await signInAs(role);
    store.dispatch(usersHydrated([
      { id: '8', name: 'Lead', role: 'TeamLead' },
      { id: '9', name: 'Surveyor', role: 'Surveyor' },
    ]));
    const assignedSurveyorId = role === 'Manager' ? 8 : 9;
    const result = await store.dispatch(createJob({
      siteName: job.siteName, siteAddress: job.address, scheduledDate: '2026-12-01',
      assignedSurveyorId, notes: '',
    })).unwrap();
    const assignment = role === 'Manager' ? result.assignedTo : result.assignedSurveyor;
    expect(assignment).toEqual({
      userId: String(assignedSurveyorId), role: role === 'Manager' ? 'TeamLead' : 'Surveyor',
    });
    const fresh = makeStore();
    await runHydrators(fresh.dispatch);
    const rehydrated = fresh.getState().jobs.entities[result.id];
    expect(role === 'Manager' ? rehydrated?.assignedTo : rehydrated?.assignedSurveyor).toEqual(assignment);
    fresh.dispatch(baseApi.util.resetApiState());
  });
});

describe('shared management features', () => {
  it.each(['Manager', 'TeamLead'] as const)('rejects the wrong target role for %s before writing or requesting', async (role) => {
    await signInAs(role);
    store.dispatch(jobsHydrated([job]));
    store.dispatch(usersHydrated([
      { id: '8', name: 'Lead', role: 'TeamLead' },
      { id: '9', name: 'Surveyor', role: 'Surveyor' },
    ]));
    const assignedTo = role === 'Manager'
      ? { userId: '9', role: 'Surveyor' as const }
      : { userId: '8', role: 'TeamLead' as const };
    await expect(store.dispatch(createJob({
      siteName: job.siteName, siteAddress: job.address, scheduledDate: '2026-12-01',
      assignedSurveyorId: Number(assignedTo.userId), notes: '',
    })).unwrap()).rejects.toBe('Select an eligible assignee.');
    await expect(store.dispatch(assignJobLocalFirst({
      job, assignedTo, actor: { userId: '7', role },
    })).unwrap()).rejects.toBe('Select an eligible assignee.');
    await expect(store.dispatch(editJob({
      id: job.id, siteName: job.siteName, siteAddress: job.address, scheduledDate: '2026-12-01',
      notes: '', assignedTo,
    })).unwrap()).rejects.toBe('Select an eligible assignee.');
    expect(requests).toEqual([]);
    expect(await db.jobs.count()).toBe(0);
  });

  it.each(['Manager', 'TeamLead'] as const)('grants %s the same job visibility and editing access', (role) => {
    const actor = { userId: '7', role };
    expect(scopeJobsToActor([job], actor)).toEqual([job]);
    expect(canAssign(actor, job)).toBe(true);
    expect(canEditJob(actor, job)).toBe(true);
    expect(canEditJob(actor, { ...job, status: 'submitted' })).toBe(false);
  });

  it.each(['Manager', 'TeamLead'] as const)('exposes review actions through the %s route', async (role) => {
    await signInAs(role);
    renderRoute('/dashboard/jobdetails/21');
    await screen.findByRole('button', { name: 'Approve' });
    expect(screen.getByRole('button', { name: 'Return' })).toBeDefined();
  });

  it.each(['Manager', 'TeamLead'] as const)('shows shared paths and role-specific behavior for %s', async (role) => {
    await signInAs(role);
    renderRoute(roleHome(role));
    await screen.findByText('Shared Site');
    expect(screen.getByRole('link', { name: 'Create Job' }).getAttribute('href')).toBe('/createJob');
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
    expect(screen.getByRole('link', { name: 'View more details for Shared Site' }).getAttribute('href'))
      .toBe('/dashboard/jobdetails/21');
  });
});
