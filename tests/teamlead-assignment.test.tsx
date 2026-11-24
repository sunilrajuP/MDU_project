import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/api/baseApi';
import { db } from '@/data/db/schema';
import { runHydrators } from '@/data/hydration/registry';
import { authRepo } from '@/data/repos/authRepo';
import { jobsRepo } from '@/data/repos/jobsRepo';
import authReducer, { authHydrated } from '@/features/auth/authSlice';
import { CreateJobPage } from '@/features/createJob/CreateJobPage';
import { JobCard } from '@/features/jobs/components/JobCard';
import { JobDetailsPage } from '@/features/jobs/JobDetailsPage';
import { ManagerDashboardPage } from '@/features/manager/ManagerDashboardPage';
import { syncPendingJobs } from '@/features/jobs/jobSync';
import jobsReducer, { jobsHydrated } from '@/features/jobs/jobsSlice';
import { assignJobLocalFirst, createJob, editJob } from '@/features/jobs/jobsThunks';
import teamReducer, { usersHydrated } from '@/features/teamlead/teamSlice';
import type { ApiJob } from '@/types/api';

function makeStore() {
  return configureStore({
    reducer: { auth: authReducer, jobs: jobsReducer, team: teamReducer, api: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

const session = { userId: '7', name: 'Lead', role: 'TeamLead' as const, accessToken: 'test-token' };
const surveyor = { id: '9', name: 'Surveyor', role: 'Surveyor' as const };
const details = { siteName: 'Site', siteAddress: 'Address', scheduledDate: '2026-12-01', notes: '' };
let store: ReturnType<typeof makeStore>;
let row: ApiJob;
let requests: { url: string; body: Record<string, unknown> }[];
let omitMutationSurveyorName: boolean;

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await authRepo.set(session);
  store = makeStore();
  store.dispatch(authHydrated(session));
  store.dispatch(jobsHydrated([]));
  store.dispatch(usersHydrated([surveyor]));
  row = {
    id: 21, jobRef: 'MDU-21', siteName: 'Site', siteAddress: 'Address',
    status: 'YetToAssign', assigneeName: null, latestSurveyorName: null,
    scheduledDate: '2026-12-01',
  };
  requests = [];
  omitMutationSurveyorName = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    requests.push({ url, body });
    if (url === '/api/users/team') {
      return Response.json([{ id: 9, displayName: 'Surveyor', email: 's@example.test', isActive: true }]);
    }
    if (url === '/api/jobs') return Response.json([row]);
    if (url === '/api/job/21') return Response.json(row);
    if (url === '/api/job/create_job' || url.includes('update_job') || url.includes('reassign_job')) {
      row = {
        ...row, ...body,
        latestSurveyorName: body.assignedSurveyorId === undefined ? row.latestSurveyorName
          : body.assignedSurveyorId === null ? null : 'Surveyor',
      };
      if (omitMutationSurveyorName) {
        const response = { ...row };
        delete response.latestSurveyorName;
        return Response.json(response);
      }
      return Response.json(row);
    }
    throw new Error(`Unexpected request: ${url}`);
  }));
});

afterEach(() => {
  store.dispatch(baseApi.util.resetApiState());
  vi.unstubAllGlobals();
});

describe('Team Lead surveyor assignment', () => {
  it('maps the Team Lead jobs response into separate lead and surveyor display values', async () => {
    row = {
      id: 21, jobRef: 'MDU-000024', siteName: 'Jntu',
      siteAddress: '145 Studley Road, Heidelberg VIC 3084',
      status: 'NotStarted', assigneeTeamLead: 'Sunil', latestSurveyorName: 'Santhi',
      createdByName: 'Sunil', scheduledDate: '2026-12-05',
    };
    const job = (await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap()).jobs[0];
    expect(job.assigneeName).toBe('Sunil');
    expect(job.latestSurveyorName).toBe('Santhi');
    expect(job.status).toBe('assigned_surveyor');
    const fresh = makeStore();
    await runHydrators(fresh.dispatch);
    expect(fresh.getState().jobs.entities[job.id]?.assigneeName).toBe('Sunil');
    render(
      <Provider store={store}>
        <MemoryRouter>
          <JobCard job={job} detailsPath="/" assigneeTeamLead={job.assigneeName} latestSurveyorName={job.latestSurveyorName} />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByTitle('Lead: Sunil')).toBeTruthy();
    expect(screen.getByTitle('Surveyor: Santhi')).toBeTruthy();
    fresh.dispatch(baseApi.util.resetApiState());
  });

  it('displays the Team Lead response on the dashboard', async () => {
    row = {
      ...row, assigneeName: undefined, assigneeTeamLead: 'Sunil',
      latestSurveyorName: 'Santhi', status: 'NotStarted',
    };
    render(
      <Provider store={store}>
        <MemoryRouter><ManagerDashboardPage /></MemoryRouter>
      </Provider>,
    );
    expect(await screen.findByTitle('Lead: Sunil')).toBeTruthy();
    expect(screen.getByTitle('Surveyor: Santhi')).toBeTruthy();
  });

  it.each(['Manager', 'TeamLead'] as const)('clears stale lead data when the %s response explicitly unassigns the lead', async (role) => {
    const currentSession = { ...session, role };
    await authRepo.set(currentSession);
    store.dispatch(authHydrated(currentSession));
    const existing = {
      id: '21', siteName: 'Site', address: 'Address', status: 'new' as const,
      createdBy: { userId: '1', role: 'Manager' as const },
      assignedTo: { userId: '7', role: 'TeamLead' as const }, assigneeName: 'Old Lead',
      siteDetails: {}, assignmentHistory: [], attempt: 0, updatedAt: '2020-01-01T00:00:00Z',
      dirty: false, syncStatus: 'synced' as const,
    };
    await jobsRepo.upsert(existing);
    row = { ...row, assigneeTeamLead: null, assigneeName: 'Stale Lead' };
    const job = (await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap()).jobs[0];
    expect(job.assigneeName).toBeUndefined();
    expect(job.assignedTo).toBeUndefined();
  });

  it('retains the lead on a detail response that omits both lead fields', async () => {
    row = { ...row, assigneeName: undefined, assigneeTeamLead: 'Sunil' };
    await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
    row = { ...row, assigneeTeamLead: undefined };
    const job = await store.dispatch(baseApi.endpoints.getJob.initiate('21')).unwrap();
    expect(job.assigneeName).toBe('Sunil');
  });

  it('uses the explicit lead field for Managers when both fields are present', async () => {
    const manager = { ...session, role: 'Manager' as const };
    await authRepo.set(manager);
    store.dispatch(authHydrated(manager));
    row = { ...row, assigneeName: 'Manager Lead', assigneeTeamLead: 'Other Lead' };
    const job = (await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap()).jobs[0];
    expect(job.assigneeName).toBe('Other Lead');
  });

  it.each(['Manager', 'TeamLead'] as const)(
    'does not fetch missing lead details on the dashboard for %s',
    async (role) => {
      const currentSession = { ...session, role };
      await authRepo.set(currentSession);
      store.dispatch(authHydrated(currentSession));
      const list = {
        ...row, assigneeName: undefined, assigneeTeamLead: undefined,
        latestSurveyorName: 'Surveyor', createdByName: 'Creator', createdDate: '2026-11-01',
      };
      vi.mocked(fetch).mockImplementation(async (url: string) => {
        if (url === '/api/jobs') return Response.json([list]);
        throw new Error(`Unexpected request: ${url}`);
      });
      render(<Provider store={store}><MemoryRouter><ManagerDashboardPage /></MemoryRouter></Provider>);
      expect(await screen.findByTitle('Lead: Not available')).toBeTruthy();
      expect(screen.getByTitle('Surveyor: Surveyor')).toBeTruthy();
      const fresh = makeStore();
      await runHydrators(fresh.dispatch);
      expect(fresh.getState().jobs.entities['21']?.assigneeName).toBeUndefined();
      expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(['/api/jobs']);
      fresh.dispatch(baseApi.util.resetApiState());
    },
  );

  it('does not display a surveyor actor as the lead when no lead is assigned', async () => {
    const manager = { ...session, role: 'Manager' as const };
    await authRepo.set(manager);
    store.dispatch(authHydrated(manager));
    row = { ...row, assigneeTeamLead: null, assignedSurveyorId: 9, latestSurveyorName: 'Surveyor' };
    await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/jobs/MDU-21']}>
          <Routes><Route path="/jobs/:jobRef" element={<JobDetailsPage backPath="/" />} /></Routes>
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByText('Lead').parentElement?.textContent).toBe('LeadUnassigned');
    expect(screen.getByText('Assigned to').parentElement?.textContent).toBe('Assigned toSurveyor');
  });

  it('shows an unknown lead as unavailable without requesting details', async () => {
    row = {
      ...row, assigneeName: undefined, assigneeTeamLead: undefined,
      createdByName: 'Creator', createdDate: '2026-11-01',
    };
    vi.mocked(fetch).mockImplementation(async (url: string) => {
      if (url === '/api/jobs') return Response.json([row]);
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<Provider store={store}><MemoryRouter><ManagerDashboardPage /></MemoryRouter></Provider>);
    expect(await screen.findByTitle('Lead: Not available')).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(['/api/jobs']);
  });

  it.each(['Manager', 'TeamLead'] as const)(
    'retains the list lead when %s detail only has a generic assignee and surveyor',
    async (role) => {
      const currentSession = { ...session, role };
      await authRepo.set(currentSession);
      store.dispatch(authHydrated(currentSession));
      row = { ...row, assigneeTeamLead: 'Actual Lead', assigneeName: 'Actual Lead', latestSurveyorName: 'Surveyor' };
      await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
      row = { ...row, assigneeTeamLead: undefined, assigneeName: 'Surveyor' };
      render(
        <Provider store={store}>
          <MemoryRouter initialEntries={['/jobs/MDU-21']}>
            <Routes><Route path="/jobs/:jobRef" element={<JobDetailsPage backPath="/" />} /></Routes>
          </MemoryRouter>
        </Provider>,
      );
      await waitFor(() => expect(requests.some(({ url }) => url === '/api/job/21')).toBe(true));
      await waitFor(() => expect(baseApi.endpoints.getJob.select('21')(store.getState()).isSuccess).toBe(true));
      expect(store.getState().jobs.entities['21']?.assigneeName).toBe('Actual Lead');
      expect(screen.getByText('Actual Lead')).toBeTruthy();
      expect(screen.getAllByText('Surveyor')).toHaveLength(2);
      const fresh = makeStore();
      await runHydrators(fresh.dispatch);
      expect(fresh.getState().jobs.entities['21']?.assigneeName).toBe('Actual Lead');
      expect(fresh.getState().jobs.entities['21']?.latestSurveyorName).toBe('Surveyor');
      fresh.dispatch(baseApi.util.resetApiState());
    },
  );

  it('creates a surveyor assignment without assigning a lead and rehydrates it', async () => {
    const job = await store.dispatch(createJob({ ...details, assignedSurveyorId: 9 })).unwrap();
    expect(job.assigneeName).toBeUndefined();
    expect(job.assignedTo).toBeUndefined();
    expect(job.latestSurveyorName).toBe('Surveyor');
    expect(job.status).toBe('assigned_surveyor');
    const fresh = makeStore();
    await runHydrators(fresh.dispatch);
    expect(fresh.getState().jobs.entities[job.id]).toEqual(job);
    fresh.dispatch(baseApi.util.resetApiState());
  });

  it('maps lead and surveyor names independently on list and detail, including unassignment', async () => {
    row = { ...row, status: 'NotStarted', assigneeName: 'Current Lead', latestSurveyorName: 'Surveyor' };
    const first = (await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap()).jobs[0];
    expect(first.assigneeName).toBe('Current Lead');
    expect(first.latestSurveyorName).toBe('Surveyor');
    expect(first.status).toBe('assigned_surveyor');
    row = { ...row, latestSurveyorName: null };
    const second = await store.dispatch(baseApi.endpoints.getJob.initiate('21')).unwrap();
    expect(second.assigneeName).toBe('Current Lead');
    expect(second.latestSurveyorName).toBeUndefined();
    expect(second.status).toBe('new');
  });

  it('clears a cached surveyor ID when the server reports no surveyor', async () => {
    row = { ...row, assignedSurveyorId: 9, latestSurveyorName: 'Surveyor' };
    await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
    row = { ...row, assignedSurveyorId: undefined, latestSurveyorName: null };
    const job = await store.dispatch(baseApi.endpoints.getJob.initiate('21')).unwrap();
    expect(job.assignedSurveyor).toBeUndefined();
    expect(job.latestSurveyorName).toBeUndefined();
    expect(job.status).toBe('new');
  });

  it('does not replace later workflow statuses when a surveyor is assigned', async () => {
    row = { ...row, status: 'InProgress', latestSurveyorName: null };
    const job = (await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap()).jobs[0];
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      const saved = await store.dispatch(assignJobLocalFirst({
        job, actor: session, assignedTo: { userId: '9', role: 'Surveyor' },
      })).unwrap();
      expect(saved.status).toBe('in_progress');
    } finally {
      online.mockRestore();
    }
  });

  it('edits the surveyor without overwriting the existing lead, including unassignment', async () => {
    row = { ...row, assigneeName: 'Current Lead' };
    const job = (await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap()).jobs[0];
    const assigned = await store.dispatch(editJob({
      ...details, id: job.id, assignedTo: { userId: '9', role: 'Surveyor' },
    })).unwrap();
    expect(requests.at(-1)?.body.assignedSurveyorId).toBe(9);
    expect(assigned.assigneeName).toBe('Current Lead');
    expect(assigned.latestSurveyorName).toBe('Surveyor');
    expect(assigned.status).toBe('assigned_surveyor');
    const unassigned = await store.dispatch(editJob({ ...details, id: job.id, assignedTo: null })).unwrap();
    expect(unassigned.assigneeName).toBe('Current Lead');
    expect(unassigned.latestSurveyorName).toBeUndefined();
    expect(unassigned.status).toBe('new');
  });

  it('handles mutation responses that omit the surveyor name', async () => {
    row = { ...row, assigneeName: 'Current Lead' };
    const job = (await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap()).jobs[0];
    omitMutationSurveyorName = true;
    const assigned = await store.dispatch(editJob({
      ...details, id: job.id, assignedTo: { userId: '9', role: 'Surveyor' },
    })).unwrap();
    expect(assigned.latestSurveyorName).toBe('Surveyor');
    expect(assigned.status).toBe('assigned_surveyor');
    const unassigned = await store.dispatch(editJob({ ...details, id: job.id, assignedTo: null })).unwrap();
    expect(unassigned.latestSurveyorName).toBeUndefined();
    expect(unassigned.assigneeName).toBe('Current Lead');
    expect(unassigned.status).toBe('new');
  });

  it('does not replace the lead during an offline surveyor reassignment', async () => {
    row = { ...row, assigneeName: 'Current Lead' };
    const job = (await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap()).jobs[0];
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      const saved = await store.dispatch(assignJobLocalFirst({
        job, actor: session, assignedTo: { userId: '9', role: 'Surveyor' },
      })).unwrap();
      expect(saved.assigneeName).toBe('Current Lead');
      expect(saved.latestSurveyorName).toBe('Surveyor');
      expect(saved.status).toBe('assigned_surveyor');
      expect((await jobsRepo.getById(job.id))?.assigneeName).toBe('Current Lead');
      online.mockReturnValue(true);
      await store.dispatch(syncPendingJobs());
      const synced = await jobsRepo.getById(job.id);
      expect(synced?.assigneeName).toBe('Current Lead');
      expect(synced?.latestSurveyorName).toBe('Surveyor');
      expect(synced?.status).toBe('assigned_surveyor');
      expect(synced?.dirty).toBe(false);
      const fresh = makeStore();
      await runHydrators(fresh.dispatch);
      expect(fresh.getState().jobs.entities[job.id]).toEqual(synced);
      fresh.dispatch(baseApi.util.resetApiState());
    } finally {
      online.mockRestore();
    }
  });

  it('displays the lead and surveyor in separate card fields', async () => {
    row = { ...row, assigneeName: 'Current Lead', latestSurveyorName: 'Surveyor', status: 'NotStarted' };
    const job = (await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap()).jobs[0];
    render(
      <Provider store={store}>
        <MemoryRouter>
          <JobCard job={job} detailsPath="/" assigneeTeamLead={job.assigneeName} latestSurveyorName={job.latestSurveyorName} />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByTitle('Lead: Current Lead')).toBeTruthy();
    expect(screen.getByTitle('Surveyor: Surveyor')).toBeTruthy();
    expect(screen.getByText('Not Started')).toBeTruthy();
  });

  it('leaves Manager status mapping unchanged', async () => {
    const manager = { ...session, role: 'Manager' as const };
    await authRepo.set(manager);
    store.dispatch(authHydrated(manager));
    row = { ...row, status: 'NotStarted', assigneeName: 'Current Lead', latestSurveyorName: null };
    const job = (await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap()).jobs[0];
    expect(job.status).toBe('assigned_surveyor');
    expect(job.assigneeName).toBe('Current Lead');
  });

  it('shows Unassigned in the Team Lead surveyor dropdown rather than the lead', async () => {
    row = { ...row, assigneeName: 'Current Lead' };
    await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/jobs/21/edit']}>
          <Routes><Route path="/jobs/:id/edit" element={<CreateJobPage backPath="/" />} /></Routes>
        </MemoryRouter>
      </Provider>,
    );
    const dropdown = screen.getByRole('combobox', { name: 'Reassign job' });
    expect(dropdown.textContent).toBe('Unassigned');
    await waitFor(() => expect((dropdown as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(dropdown);
    await screen.findByRole('option', { name: 'Surveyor' });
    expect(screen.queryByRole('option', { name: 'Current Lead' })).toBeNull();
    expect(requests.some(({ url }) => url === '/api/users/team')).toBe(true);
  });
});
