import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/api/baseApi';
import { NotificationProvider } from '@/components/ui/NotificationProvider';
import { db } from '@/data/db/schema';
import { runHydrators } from '@/data/hydration/registry';
import { authRepo } from '@/data/repos/authRepo';
import { jobsRepo } from '@/data/repos/jobsRepo';
import authReducer, { authHydrated } from '@/features/auth/authSlice';
import { CreateJobPage } from '@/features/createJob/CreateJobPage';
import { JobCard } from '@/features/jobs/components/JobCard';
import jobCardStyles from '@/features/jobs/components/JobCard.module.scss';
import jobsReducer, { jobsHydrated, selectJobById } from '@/features/jobs/jobsSlice';
import { createJob, editJob } from '@/features/jobs/jobsThunks';
import { syncPendingJobs } from '@/features/jobs/jobSync';
import teamReducer, { usersHydrated } from '@/features/teamlead/teamSlice';
import { canEditJob } from '@/config/rules/assignment';
import { chooseCalendarDate } from './date-picker-helpers';
import type { ApiJob } from '@/types/api';
import type { Job } from '@/types/domain';

function makeStore() {
  return configureStore({
    reducer: { auth: authReducer, jobs: jobsReducer, team: teamReducer, api: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

const session = { userId: '1', name: 'Manager', role: 'Manager' as const, accessToken: 'test-token' };
const original: Job = {
  id: '21', jobRef: 'MDU-000021', siteName: 'Original Site', address: '10 Original Street',
  scheduledDate: '2026-11-28T10:00:00Z', status: 'new',
  createdDate: '2026-10-20T09:30:00Z',
  createdBy: { userId: '1', role: 'Manager' },
  createdByName: 'Original Creator',
  assignedTo: { userId: '7', role: 'TeamLead' }, assigneeName: 'Current Lead',
  siteDetails: { notes: 'Existing comments', buildingType: 'Apartment', numUnits: 12 },
  assignmentHistory: [], attempt: 2, updatedAt: '2026-11-01T00:00:00Z',
  dirty: false, syncStatus: 'synced',
};
const details = {
  id: '21', siteName: 'Updated Site', siteAddress: '20 Updated Street',
  scheduledDate: '2026-12-01', notes: 'Updated comments',
};
let store: ReturnType<typeof makeStore>;
let serverJob: ApiJob;
let failUpdate: boolean;
let serverError: string | undefined;
let requests: { method: string; url: string; body: Record<string, unknown> }[];

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await authRepo.set(session);
  await jobsRepo.upsert(original);
  serverJob = {
    id: 21, jobRef: original.jobRef!, siteName: original.siteName, siteAddress: original.address,
    status: 'YetToAssign', assigneeName: 'Current Lead', scheduledDate: original.scheduledDate!,
  };
  failUpdate = false;
  serverError = undefined;
  requests = [];
  store = makeStore();
  store.dispatch(authHydrated(session));
  store.dispatch(jobsHydrated([original]));
  store.dispatch(usersHydrated([{ id: '8', name: 'New Lead', role: 'TeamLead' }]));
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    requests.push({ method, url, body });
    if (url.includes('update_job')) {
      if (failUpdate) throw new TypeError('Network unavailable');
      if (serverError) return Response.json({ error: serverError }, { status: 400 });
      const teamLead = (await authRepo.get())?.role === 'TeamLead';
      serverJob = {
        ...serverJob, ...body,
        assigneeName: teamLead ? serverJob.assigneeName
          : body.assignedSurveyorId === null ? null
            : body.assignedSurveyorId === 8 ? 'New Lead' : serverJob.assigneeName,
        ...(teamLead && body.assignedSurveyorId !== undefined
          ? { latestSurveyorName: body.assignedSurveyorId === null ? null : 'Surveyor' } : {}),
      };
      return Response.json(serverJob);
    }
    if (url.includes('create_job')) {
      if (serverError) return Response.json({ error: serverError }, { status: 400 });
      return Response.json({ ...serverJob, ...body, id: 22 });
    }
    if (url === '/api/users/team' || url === '/api/user/team') {
      return Response.json((await authRepo.get())?.role === 'TeamLead'
        ? [{ id: 9, displayName: 'Surveyor', email: 'surveyor@example.test', isActive: true }]
        : [
          { id: 7, displayName: 'Current Lead', email: 'current@example.test', isActive: true },
          { id: 8, displayName: 'New Lead', email: 'lead@example.test', isActive: true },
        ]);
    }
    if (url === '/api/jobs') return Response.json([serverJob]);
    if (url === '/api/job/21') return Response.json(serverJob);
    if (url === '/api/21/survey') {
      return Response.json({ jobId: '21', status: 'not_started', checklist: [], photos: [] });
    }
    throw new Error(`Unexpected request: ${url}`);
  }));
});

afterEach(() => {
  store.dispatch(baseApi.util.resetApiState());
  vi.unstubAllGlobals();
});

function renderForm(path = '/manager/jobs/21/edit') {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dashboard/editjob/:jobRef" element={<CreateJobPage backPath="/dashboard" />} />
          <Route path="/manager/jobs/:id/edit" element={<CreateJobPage backPath="/manager/dashboard" />} />
          <Route path="/manager/jobs/new" element={<CreateJobPage backPath="/manager/dashboard" />} />
          <Route path="/manager/dashboard" element={<p>Dashboard destination</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

function renderFormWithNotifications(path: string) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <NotificationProvider>
          <Routes>
            <Route path="/manager/jobs/:id/edit" element={<CreateJobPage backPath="/manager/dashboard" />} />
            <Route path="/manager/jobs/new" element={<CreateJobPage backPath="/manager/dashboard" />} />
            <Route path="/manager/dashboard" element={<><p>Dashboard destination</p><Link to="/other">Other page</Link></>} />
            <Route path="/other" element={<p>Other destination</p>} />
          </Routes>
        </NotificationProvider>
      </MemoryRouter>
    </Provider>,
  );
}

async function fillNewJob() {
  fireEvent.change(screen.getByLabelText(/Site\/Job Name/), { target: { value: details.siteName } });
  fireEvent.change(screen.getByLabelText(/Site Address/), { target: { value: details.siteAddress } });
  fireEvent.change(screen.getByLabelText('Comments'), { target: { value: details.notes } });
  await chooseCalendarDate(screen.getByLabelText(/Scheduled Date/), details.scheduledDate);
}

describe('job outcome announcements', () => {
  it('announces a confirmed create across navigation and rehydrates the saved job', async () => {
    renderFormWithNotifications('/manager/jobs/new');
    await fillNewJob();
    fireEvent.click(screen.getByRole('button', { name: 'Create Job' }));

    await screen.findByText('Dashboard destination');
    const announcement = screen.getByText('Job created successfully.');
    expect(announcement.getAttribute('role')).toBe('status');
    expect(announcement.getAttribute('aria-live')).toBe('polite');
    expect((await jobsRepo.getById('22'))?.siteName).toBe(details.siteName);
    const fresh = makeStore();
    await runHydrators(fresh.dispatch);
    expect(selectJobById(fresh.getState(), '22')?.siteName).toBe(details.siteName);
    fresh.dispatch(baseApi.util.resetApiState());
    fireEvent.click(screen.getByRole('link', { name: 'Other page' }));
    await screen.findByText('Other destination');
    expect(screen.getByText('Job created successfully.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Job created successfully.')).toBeNull();
  });

  it('announces a confirmed update after navigation and restores it in a fresh store', async () => {
    renderFormWithNotifications('/manager/jobs/21/edit');
    fireEvent.change(screen.getByLabelText(/Site\/Job Name/), { target: { value: details.siteName } });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await screen.findByText('Dashboard destination');
    const announcement = screen.getByText('Job updated successfully.');
    expect(announcement.getAttribute('role')).toBe('status');
    expect(announcement.getAttribute('aria-live')).toBe('polite');
    const fresh = makeStore();
    await runHydrators(fresh.dispatch);
    expect(selectJobById(fresh.getState(), '21')?.siteName).toBe(details.siteName);
    fresh.dispatch(baseApi.util.resetApiState());
  });

  it('announces a create failure, preserves the form, and replaces the error on retry', async () => {
    serverError = 'Creation rejected.';
    renderFormWithNotifications('/manager/jobs/new');
    await fillNewJob();
    fireEvent.click(screen.getByRole('button', { name: 'Create Job' }));

    const alert = await screen.findByText('Could not create job. Creation rejected.');
    expect(alert.getAttribute('role')).toBe('alert');
    expect((screen.getByLabelText(/Site\/Job Name/) as HTMLInputElement).value).toBe(details.siteName);
    expect((screen.getByLabelText(/Site Address/) as HTMLInputElement).value).toBe(details.siteAddress);
    expect((screen.getByLabelText('Comments') as HTMLTextAreaElement).value).toBe(details.notes);
    expect(screen.queryByText('Dashboard destination')).toBeNull();
    expect(await jobsRepo.getById('22')).toBeUndefined();
    serverError = undefined;
    fireEvent.click(screen.getByRole('button', { name: 'Create Job' }));
    await screen.findByText('Dashboard destination');
    expect(screen.getByText('Job created successfully.')).toBeDefined();
    expect(screen.queryByText('Could not create job. Creation rejected.')).toBeNull();
  });

  it('announces an update failure, retains edits, and allows a successful retry', async () => {
    failUpdate = true;
    renderFormWithNotifications('/manager/jobs/21/edit');
    fireEvent.change(screen.getByLabelText(/Site\/Job Name/), { target: { value: details.siteName } });
    fireEvent.change(screen.getByLabelText('Comments'), { target: { value: details.notes } });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    const alert = await screen.findByText(/Could not update job\. Unable to reach the server/);
    expect(alert.getAttribute('role')).toBe('alert');
    expect((screen.getByLabelText(/Site\/Job Name/) as HTMLInputElement).value).toBe(details.siteName);
    expect((screen.getByLabelText('Comments') as HTMLTextAreaElement).value).toBe(details.notes);
    expect(screen.queryByText('Dashboard destination')).toBeNull();
    expect(await jobsRepo.getById('21')).toEqual(original);
    failUpdate = false;
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await screen.findByText('Dashboard destination');
    expect(screen.getByText('Job updated successfully.')).toBeDefined();
    expect(screen.queryByText(/Could not update job\./)).toBeNull();
  });

  it.each([
    ['/manager/jobs/new', 'Create Job', 'create'],
    ['/manager/jobs/21/edit', 'Update', 'edit'],
  ])('reports offline %s without claiming it was saved', async (path, button, action) => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      renderFormWithNotifications(path);
      if (action === 'create') await fillNewJob();
      else fireEvent.change(screen.getByLabelText(/Site\/Job Name/), { target: { value: details.siteName } });
      fireEvent.click(screen.getByRole('button', { name: button }));
      const alert = await screen.findByText(`Could not ${action === 'edit' ? 'update' : 'create'} job. Connect to the internet to ${action} a job.`);
      expect(alert.getAttribute('role')).toBe('alert');
      expect((screen.getByLabelText(/Site\/Job Name/) as HTMLInputElement).value).toBe(details.siteName);
      expect(screen.queryByText('Dashboard destination')).toBeNull();
      expect(await jobsRepo.getById('21')).toEqual(original);
      expect(await db.syncQueue.count()).toBe(0);
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe('job editing persistence', () => {
  it.each([undefined, 'new', 'in_progress', 'submitted'] as const)(
    'uses the API NotStarted status instead of the cached status (%s)',
    async (cachedStatus) => {
      if (cachedStatus) {
        await jobsRepo.upsert({ ...original, status: cachedStatus });
      } else {
        await db.jobs.clear();
      }
      serverJob.status = 'NotStarted';

      const { jobs } = await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
      const job = jobs[0];
      expect(job.status).toBe('assigned_surveyor');
      expect(selectJobById(store.getState(), job.id)?.status).toBe('assigned_surveyor');
      expect((await jobsRepo.getById(job.id))?.status).toBe('assigned_surveyor');

      const fresh = makeStore();
      await runHydrators(fresh.dispatch);
      expect(selectJobById(fresh.getState(), job.id)?.status).toBe('assigned_surveyor');
      render(
        <Provider store={fresh}>
          <MemoryRouter>
            <JobCard job={selectJobById(fresh.getState(), job.id)!} detailsPath="/manager/jobs/21" />
          </MemoryRouter>
        </Provider>,
      );
      expect(screen.getByText('Not Started')).toBeTruthy();
      expect(screen.queryByText('Yet to Assign')).toBeNull();
    },
  );

  it('rejects create and edit while offline without saving or queuing either write', async () => {
    const connection = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      await expect(store.dispatch(createJob({ ...details, assignedSurveyorId: null })).unwrap())
        .rejects.toContain('Connect to the internet');
      await expect(store.dispatch(editJob(details)).unwrap())
        .rejects.toContain('Connect to the internet');
      expect(requests).toHaveLength(0);
      expect(await jobsRepo.getAll()).toEqual([original]);
      expect(await db.syncQueue.count()).toBe(0);
      connection.mockReturnValue(true);
      await store.dispatch(syncPendingJobs());
      expect(requests).toHaveLength(0);
    } finally {
      connection.mockRestore();
    }
  });

  it('uses the backend error field for failed job creation', async () => {
    serverError = 'Scheduled date cannot be in the past.';
    await expect(store.dispatch(createJob({ ...details, assignedSurveyorId: null })).unwrap())
      .rejects.toMatchObject({ message: serverError });
    expect(await jobsRepo.getAll()).toEqual([original]);
  });

  it('does not show a new job until the server confirms creation', async () => {
    let respond: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { respond = resolve; }));
    const pending = store.dispatch(createJob({ ...details, assignedSurveyorId: null })).unwrap();
    await waitFor(() => expect(respond).toBeDefined());
    expect(await jobsRepo.getAll()).toEqual([original]);
    expect(await db.syncQueue.count()).toBe(0);
    respond!(Response.json({ ...serverJob, id: 22, siteName: details.siteName }));
    const job = await pending;
    expect(job).toMatchObject({ id: '22', siteName: details.siteName, syncStatus: 'synced' });
    expect(selectJobById(store.getState(), '22')).toEqual(job);
    expect(await jobsRepo.getById('22')).toEqual(job);
  });

  it('does not queue or display a job when the create request loses its connection', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Network unavailable'));
    await expect(store.dispatch(createJob({ ...details, assignedSurveyorId: null })).unwrap())
      .rejects.toMatchObject({ message: 'Unable to reach the server. Check your connection.' });
    expect(await jobsRepo.getAll()).toEqual([original]);
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('updates the same job, sends the confirmed PUT payload, and rehydrates metadata', async () => {
    const saved = await store.dispatch(editJob({
      ...details, assignedTo: { userId: '8', role: 'TeamLead' },
    })).unwrap();
    expect(saved.id).toBe(original.id);
    expect(requests.find((request) => request.method === 'PUT')).toEqual({
      url: '/api/job/update_job/21', method: 'PUT',
      body: {
        siteName: details.siteName, siteAddress: details.siteAddress,
        scheduledDate: details.scheduledDate, comments: details.notes, assignedSurveyorId: 8,
        updatedDate: saved.updatedDate,
      },
    });
    expect(saved.createdDate).toBe(original.createdDate);
    expect(saved.createdByName).toBe('Original Creator');
    expect(requests.find((request) => request.method === 'PUT')?.body).not.toHaveProperty('createdBy');
    expect(saved.updatedDate).toBeTruthy();
    expect(saved.updatedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(saved.siteDetails).toEqual({ ...original.siteDetails, notes: details.notes });
    expect(saved.assignmentHistory).toHaveLength(1);
    expect(saved.assignedTo).toEqual({ userId: '8', role: 'TeamLead' });
    expect(saved.dirty).toBe(false);
    await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
    const fresh = makeStore();
    await runHydrators(fresh.dispatch);
    expect(selectJobById(fresh.getState(), '21')).toEqual(await jobsRepo.getById('21'));
    expect(selectJobById(fresh.getState(), '21')?.siteDetails.notes).toBe(details.notes);
    expect(selectJobById(fresh.getState(), '21')?.createdDate).toBe(original.createdDate);
    expect(selectJobById(fresh.getState(), '21')?.createdByName).toBe('Original Creator');
    expect(selectJobById(fresh.getState(), '21')?.updatedDate).toBe(saved.updatedDate);
    expect(await jobsRepo.getAll()).toHaveLength(1);
    fresh.dispatch(baseApi.util.resetApiState());
  });

  it('sends the existing assignment when it is unchanged', async () => {
    await store.dispatch(editJob(details)).unwrap();
    expect(requests[0].body.assignedSurveyorId).toBe(7);
    expect((await jobsRepo.getById('21'))?.assignedTo).toEqual(original.assignedTo);
  });

  it('sends null for an unchanged unassigned job', async () => {
    const unassigned = { ...original, assignedTo: undefined, assigneeName: undefined };
    await jobsRepo.upsert(unassigned);
    store.dispatch(jobsHydrated([unassigned]));
    await store.dispatch(editJob(details)).unwrap();
    expect(requests[0].body.assignedSurveyorId).toBeNull();
  });

  it('resolves a name-only current assignment from the roster', async () => {
    const nameOnly = { ...original, assignedTo: undefined };
    await jobsRepo.upsert(nameOnly);
    store.dispatch(jobsHydrated([nameOnly]));
    await store.dispatch(editJob(details)).unwrap();
    expect(requests.find((request) => request.method === 'PUT')?.body.assignedSurveyorId).toBe(7);
    expect((await jobsRepo.getById('21'))?.assignedTo).toEqual(original.assignedTo);
  });

  it('sends the current surveyor when a team lead edits without changing assignment', async () => {
    const leadSession = { ...session, userId: '7', role: 'TeamLead' as const };
    const assigned = { ...original, assignedSurveyor: { userId: '9', role: 'Surveyor' as const },
      latestSurveyorName: 'Surveyor' };
    await authRepo.set(leadSession);
    await jobsRepo.upsert(assigned);
    store.dispatch(authHydrated(leadSession));
    store.dispatch(jobsHydrated([assigned]));
    await store.dispatch(editJob(details)).unwrap();
    expect(requests[0].body.assignedSurveyorId).toBe(9);
    expect((await jobsRepo.getById('21'))?.assignedSurveyor).toEqual(assigned.assignedSurveyor);
  });

  it('resolves a team lead name-only surveyor assignment', async () => {
    const leadSession = { ...session, userId: '7', role: 'TeamLead' as const };
    const nameOnly = { ...original, assignedSurveyor: undefined, latestSurveyorName: 'Surveyor' };
    await authRepo.set(leadSession);
    await jobsRepo.upsert(nameOnly);
    store.dispatch(authHydrated(leadSession));
    store.dispatch(jobsHydrated([nameOnly]));
    await store.dispatch(editJob(details)).unwrap();
    expect(requests.find((request) => request.method === 'PUT')?.body.assignedSurveyorId).toBe(9);
    expect((await jobsRepo.getById('21'))?.assignedSurveyor?.userId).toBe('9');
  });

  it('does not guess between roster members with the same name', async () => {
    const nameOnly = { ...original, assignedTo: undefined };
    await jobsRepo.upsert(nameOnly);
    store.dispatch(jobsHydrated([nameOnly]));
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([
      { id: 7, displayName: 'Current Lead', email: 'a@example.test', isActive: true },
      { id: 10, displayName: 'Current Lead', email: 'b@example.test', isActive: true },
    ]));
    await expect(store.dispatch(editJob(details)).unwrap()).rejects.toMatchObject({
      message: expect.stringContaining('multiple'),
    });
    expect(await jobsRepo.getById('21')).toEqual(nameOnly);
  });

  it('surfaces roster lookup errors without changing the saved job', async () => {
    const nameOnly = { ...original, assignedTo: undefined };
    await jobsRepo.upsert(nameOnly);
    store.dispatch(jobsHydrated([nameOnly]));
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Network unavailable'));
    await expect(store.dispatch(editJob(details)).unwrap()).rejects.toMatchObject({
      message: 'Unable to reach the server. Check your connection.',
    });
    expect(await jobsRepo.getById('21')).toEqual(nameOnly);
  });

  it('persists the resolved assignee if the update response omits its ID', async () => {
    const nameOnly = { ...original, assignedTo: undefined };
    await jobsRepo.upsert(nameOnly);
    store.dispatch(jobsHydrated([nameOnly]));
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json([
        { id: 7, displayName: 'Current Lead', email: 'current@example.test', isActive: true },
      ]))
      .mockResolvedValueOnce(Response.json(serverJob));
    await store.dispatch(editJob(details)).unwrap();
    const fresh = makeStore();
    await runHydrators(fresh.dispatch);
    expect(selectJobById(fresh.getState(), '21')?.assignedTo).toEqual(original.assignedTo);
    fresh.dispatch(baseApi.util.resetApiState());
  });

  it('rejects an invalid current assignment ID rather than sending null', async () => {
    const invalid = { ...original, assignedTo: { userId: 'invalid', role: 'TeamLead' as const } };
    await jobsRepo.upsert(invalid);
    store.dispatch(jobsHydrated([invalid]));
    await expect(store.dispatch(editJob(details)).unwrap())
      .rejects.toMatchObject({ message: expect.stringContaining('valid ID') });
    expect(requests).toHaveLength(0);
  });

  it('explicitly unassigns without losing other job data', async () => {
    await store.dispatch(editJob({ ...details, assignedTo: null })).unwrap();
    expect(requests[0].body.assignedSurveyorId).toBeNull();
    const saved = await jobsRepo.getById('21');
    expect(saved?.assignedTo).toBeUndefined();
    expect(saved?.assigneeName).toBeUndefined();
    expect(saved?.attempt).toBe(2);
  });

  it.each([null, { userId: '8', role: 'TeamLead' as const }])(
    'leaves saved data unchanged on failure and supports a manual retry with assignment %j',
    async (assignedTo) => {
      failUpdate = true;
      await expect(store.dispatch(editJob({ ...details, assignedTo })).unwrap())
        .rejects.toMatchObject({ message: 'Unable to reach the server. Check your connection.' });
      expect(await db.syncQueue.count()).toBe(0);
      const fresh = makeStore();
      await runHydrators(fresh.dispatch);
      expect(selectJobById(fresh.getState(), '21')).toEqual(original);
      failUpdate = false;
      fresh.dispatch(usersHydrated([{ id: '8', name: 'New Lead', role: 'TeamLead' }]));
      const synced = await fresh.dispatch(editJob({ ...details, assignedTo })).unwrap();
      expect(synced.syncStatus).toBe('synced');
      expect(requests.filter((request) => request.method === 'PUT').at(-1)?.body.assignedSurveyorId)
        .toBe(assignedTo ? 8 : null);
      fresh.dispatch(baseApi.util.resetApiState());
    },
  );

  it.each(['submitted', 'approved', 'pending_qc'] as const)('rejects locked %s jobs before writing', async (status) => {
    store.dispatch(jobsHydrated([{ ...original, status }]));
    await expect(store.dispatch(editJob(details)).unwrap()).rejects.toContain('locked');
    expect(requests).toHaveLength(0);
    expect(await jobsRepo.getById('21')).toEqual(original);
  });

  it.each([null, { userId: '9', role: 'Surveyor' as const }])(
    'lets Team Leads edit their job and change its assignment online (%j)',
    async (assignedTo) => {
      const leadSession = { ...session, userId: '7', role: 'TeamLead' as const };
      await authRepo.set(leadSession);
      store.dispatch(authHydrated(leadSession));
      store.dispatch(usersHydrated([{ id: '9', name: 'Surveyor', role: 'Surveyor' }]));
      const saved = await store.dispatch(editJob({ ...details, assignedTo })).unwrap();
      expect(saved.assignedSurveyor).toEqual(assignedTo ?? undefined);
      expect(saved.assignedTo).toEqual(original.assignedTo);
      expect(saved.pendingEditBy).toBeUndefined();
      expect(saved.dirty).toBe(false);
      expect(await db.syncQueue.count()).toBe(0);
    },
  );

  it('rejects unauthorized users and ineligible reassignment', async () => {
    await expect(store.dispatch(editJob({
      ...details, assignedTo: { userId: '999', role: 'TeamLead' },
    })).unwrap()).rejects.toBe('Select an eligible assignee.');
    store.dispatch(authHydrated({ ...session, userId: '99', role: 'Surveyor' }));
    await expect(store.dispatch(editJob(details)).unwrap()).rejects.toContain('not permitted');
    expect(requests).toHaveLength(0);
  });

  it('keeps new job creation working with team lead assignment and persisted comments', async () => {
    const created = await store.dispatch(createJob({
      ...details, assignedSurveyorId: 8,
    })).unwrap();
    expect(created.id).toBe('22');
    expect(requests[0].method).toBe('POST');
    expect(requests[0].body.assignedSurveyorId).toBe(8);
    expect((await jobsRepo.getById('22'))?.siteDetails.notes).toBe(details.notes);
  });
});

describe('edit job UI', () => {
  it('visually distinguishes job metadata labels from their values', () => {
    render(
      <MemoryRouter>
        <JobCard job={original} detailsPath="/manager/jobs/21" />
      </MemoryRouter>,
    );

    for (const label of ['Created by:', 'Created Date:', 'Scheduled Date:']) {
      expect(screen.getByText(label).classList.contains(jobCardStyles.metaLabel)).toBe(true);
    }
    expect(screen.getByText('Original Creator').classList.contains(jobCardStyles.metaValue)).toBe(true);
    expect(screen.getByText('28/11/2026').classList.contains(jobCardStyles.metaValue)).toBe(true);
  });

  it('shows the creation date below the scheduled date and replaces it with the edited date', () => {
    const renderCard = (job: Job) => (
      <MemoryRouter>
        <JobCard job={job} detailsPath="/manager/jobs/21" />
      </MemoryRouter>
    );
    const { rerender } = render(renderCard(original));
    const createdLabel = screen.getByText(/Created Job:/);
    const scheduled = screen.getByText('Scheduled Date: 28/11/2026');
    expect(createdLabel.textContent).toBe('Created Job: 20/10/2026');
    expect(createdLabel.querySelector('time')?.dateTime).toBe(original.createdDate);
    expect(screen.getByText('Created by: Original Creator')).toBeDefined();
    expect(scheduled.compareDocumentPosition(createdLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    rerender(renderCard({ ...original, updatedDate: '2026-11-16T09:30:00Z' }));
    expect(screen.queryByText(/Created Job:/)).toBeNull();
    expect(screen.getByText(/Updated Job:/).textContent).toBe('Updated Job: 16/11/2026');
    expect(screen.getByText(/Updated Job:/).querySelector('time')?.dateTime).toBe('2026-11-16T09:30:00Z');
    expect(screen.getByText('Created by: Original Creator')).toBeDefined();
  });

  it('does not use the internal sync timestamp as a legacy job creation date', () => {
    render(
      <MemoryRouter>
        <JobCard job={{ ...original, createdDate: undefined, createdByName: undefined }} detailsPath="/manager/jobs/21"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Created Job: Not available')).toBeDefined();
    expect(screen.getByText('Created by: Not available')).toBeDefined();
    expect(screen.queryByText(/Updated Job:/)).toBeNull();
  });

  it('shows an accessible pencil link separate from the details link', () => {
    render(
      <MemoryRouter>
        <JobCard job={original} detailsPath="/manager/jobs/21" editPath="/manager/jobs/21/edit"
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Edit Original Site' }).getAttribute('href'))
      .toBe('/manager/jobs/21/edit');
    expect(screen.getByRole('link', { name: /Original Site\s*10 Original Street/ }).getAttribute('href'))
      .toBe('/manager/jobs/21');
    expect(canEditJob({ userId: '1', role: 'Manager' }, original)).toBe(true);
  });

  it('resolves a jobRef edit URL to the cached job', () => {
    renderForm('/dashboard/editjob/MDU-000021');

    expect((screen.getByLabelText(/Site\/Job Name/) as HTMLInputElement).value).toBe(original.siteName);
    expect((screen.getByLabelText(/Site Address/) as HTMLInputElement).value).toBe(original.address);
  });

  it('keeps the dashboard assignment display disabled immediately below status', () => {
    render(
      <MemoryRouter>
        <JobCard job={original} detailsPath="/manager/jobs/21" assigneeTeamLead="Current Lead" />
      </MemoryRouter>,
    );
    const status = screen.getByText('Yet to Assign');
    const assignment = screen.getByRole('button', { name: 'Assigned to Current Lead' });
    const scheduled = screen.getByText('Scheduled Date: 28/11/2026');
    expect((assignment as HTMLButtonElement).disabled).toBe(true);
    expect(status.compareDocumentPosition(assignment) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(assignment.compareDocumentPosition(scheduled) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(status.parentElement?.nextElementSibling).toBe(assignment);
    expect(assignment.nextElementSibling).toBe(scheduled);
  });

  it('prefills all fields and saves details plus reassignment through the edit form', async () => {
    renderForm();
    expect((screen.getByLabelText(/Site\/Job Name/) as HTMLInputElement).value).toBe(original.siteName);
    expect((screen.getByLabelText(/Site Address/) as HTMLInputElement).value).toBe(original.address);
    expect((screen.getByLabelText(/Scheduled Date/) as HTMLInputElement).value).toBe('28/11/2026');
    expect((screen.getByLabelText('Comments') as HTMLTextAreaElement).value).toBe('Existing comments');
    const assignee = screen.getByRole('combobox', { name: 'Reassign job' });
    expect(assignee.textContent).toBe('Current Lead');
    expect(screen.queryByRole('option', { name: '...' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Keep current assignment' })).toBeNull();
    await waitFor(() => expect((assignee as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(assignee);
    await screen.findByRole('option', { name: 'New Lead' });
    fireEvent.click(screen.getByRole('option', { name: 'New Lead' }));
    fireEvent.change(screen.getByLabelText(/Site\/Job Name/), { target: { value: details.siteName } });
    fireEvent.change(screen.getByLabelText('Comments'), { target: { value: details.notes } });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await screen.findByText('Dashboard destination');
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
    expect((await jobsRepo.getById('21'))?.siteName).toBe(details.siteName);
  });

  it('keeps a name-only existing assignment selected after the roster loads and sends its ID', async () => {
    const nameOnly = { ...original, assignedTo: undefined };
    await jobsRepo.upsert(nameOnly);
    store.dispatch(jobsHydrated([nameOnly]));
    renderForm();
    const assignee = screen.getByRole('combobox', { name: 'Reassign job' });
    expect(assignee.textContent).toBe('Current Lead');
    await waitFor(() => expect((assignee as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(assignee);
    const option = await screen.findByRole('option', { name: 'Current Lead' });
    expect(option.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(assignee, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await screen.findByText('Dashboard destination');
    expect(requests.find((request) => request.method === 'PUT')?.body.assignedSurveyorId).toBe(7);
    expect((await jobsRepo.getById('21'))?.assignedTo?.userId).toBe('7');
  });

  it('keeps a name-only surveyor selected when a team lead edits without reassignment', async () => {
    const leadSession = { ...session, userId: '7', role: 'TeamLead' as const };
    const nameOnly = { ...original, assignedSurveyor: undefined, latestSurveyorName: 'Surveyor' };
    await authRepo.set(leadSession);
    await jobsRepo.upsert(nameOnly);
    store.dispatch(authHydrated(leadSession));
    store.dispatch(jobsHydrated([nameOnly]));
    renderForm();
    const assignee = screen.getByRole('combobox', { name: 'Reassign job' });
    expect(assignee.textContent).toBe('Surveyor');
    await waitFor(() => expect((assignee as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(assignee);
    expect((await screen.findByRole('option', { name: 'Surveyor' })).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(assignee, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await screen.findByText('Dashboard destination');
    expect(requests.find((request) => request.method === 'PUT')?.body.assignedSurveyorId).toBe(9);
  });

  it('cancels without saving', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Site\/Job Name/), { target: { value: 'Discard me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await screen.findByText('Dashboard destination');
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
    expect(await jobsRepo.getById('21')).toEqual(original);
  });

  it('opens a deep-linked job when it is not already in Redux', async () => {
    store.dispatch(jobsHydrated([]));
    renderForm();
    await screen.findByRole('heading', { name: 'Edit Job' });
    expect((screen.getByLabelText(/Site\/Job Name/) as HTMLInputElement).value).toBe(original.siteName);
  });

  it('uses the documented single-job and survey routes', async () => {
    await store.dispatch(baseApi.endpoints.getJob.initiate('21')).unwrap();
    const survey = await store.dispatch(baseApi.endpoints.getSurveySession.initiate('21')).unwrap();
    expect(survey).toEqual({ jobId: '21', status: 'not_started', checklist: [], photos: [] });
    expect(requests.map(({ method, url }) => ({ method, url }))).toEqual([
      { method: 'GET', url: '/api/job/21' },
      { method: 'GET', url: '/api/21/survey' },
    ]);
  });

  it('does not expose editing for submitted backend jobs or locked direct links', async () => {
    serverJob.status = 'Submitted';
    const job = await store.dispatch(baseApi.endpoints.getJob.initiate('21')).unwrap();
    expect(job.status).toBe('submitted');
    expect(canEditJob({ userId: '1', role: 'Manager' }, job)).toBe(false);
    renderForm();
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('locked for review');
  });

  it('shows a not-found error rather than an empty edit form', async () => {
    renderForm('/manager/jobs/999/edit');
    await screen.findByRole('alert');
    expect(screen.queryByLabelText(/Site\/Job Name/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('keeps unsaved form input and shows a connection error when the server is unreachable', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Site\/Job Name/), { target: { value: details.siteName } });
    failUpdate = true;
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to reach the server');
    expect((screen.getByLabelText(/Site\/Job Name/) as HTMLInputElement).value).toBe(details.siteName);
    expect(screen.queryByText('Dashboard destination')).toBeNull();
    expect(await jobsRepo.getById('21')).toEqual(original);
    expect(await db.syncQueue.count()).toBe(0);
    failUpdate = false;
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await screen.findByText('Dashboard destination');
    expect((await jobsRepo.getById('21'))?.siteName).toBe(details.siteName);
  });

  it('shows the backend update error without a frontend-written prefix', async () => {
    serverError = 'Scheduled date cannot be in the past.';
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect((await screen.findByRole('alert')).textContent).toBe(serverError);
    expect(screen.queryByText('Dashboard destination')).toBeNull();
  });

  it('keeps manager create mode blank and uses the team lead roster', async () => {
    renderForm('/manager/jobs/new');
    expect((screen.getByLabelText(/Site\/Job Name/) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Comments') as HTMLTextAreaElement).value).toBe('');
    const assignee = screen.getByRole('combobox', { name: 'Assign Team Lead · optional' });
    expect(assignee.textContent).toBe('Select assignee');
    expect(assignee.hasAttribute('required')).toBe(false);
    expect(screen.queryByRole('option', { name: 'Select Team Lead' })).toBeNull();
    await waitFor(() => expect((assignee as HTMLButtonElement).disabled).toBe(false));
    fireEvent.keyDown(assignee, { key: 'ArrowDown' });
    await screen.findByRole('option', { name: 'New Lead' });
    fireEvent.keyDown(assignee, { key: 'Enter' });
    expect(assignee.textContent).toBe('New Lead');
    expect(screen.getByRole('button', { name: 'Create Job' })).toBeDefined();
  });

  it('creates a job without an optional assignment', async () => {
    renderForm('/manager/jobs/new');
    const assignee = screen.getByRole('combobox', { name: 'Assign Team Lead · optional' });
    expect(assignee.hasAttribute('required')).toBe(false);

    fireEvent.change(screen.getByLabelText(/Site\/Job Name/), { target: { value: details.siteName } });
    fireEvent.change(screen.getByLabelText(/Site Address/), { target: { value: details.siteAddress } });
    await chooseCalendarDate(screen.getByLabelText(/Scheduled Date/), details.scheduledDate);
    fireEvent.click(screen.getByRole('button', { name: 'Create Job' }));

    await screen.findByText('Dashboard destination');
    expect(requests.find((request) => request.method === 'POST')?.body.assignedSurveyorId).toBeNull();
  });
});
