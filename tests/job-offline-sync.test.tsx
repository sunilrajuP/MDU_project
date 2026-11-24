import { configureStore } from '@reduxjs/toolkit';
import Dexie from 'dexie';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/api/baseApi';
import { ConnectionPill } from '@/components/ui/ConnectionPill';
import { db } from '@/data/db/schema';
import { runHydrators } from '@/data/hydration/registry';
import { authRepo } from '@/data/repos/authRepo';
import { jobsRepo } from '@/data/repos/jobsRepo';
import authReducer, { authHydrated } from '@/features/auth/authSlice';
import { CreateJobPage } from '@/features/createJob/CreateJobPage';
import { JobCard } from '@/features/jobs/components/JobCard';
import { JobSyncLifecycle } from '@/features/jobs/JobSyncLifecycle';
import { syncPendingJobs } from '@/features/jobs/jobSync';
import jobsReducer, { jobUpserted, selectAllJobs, selectJobById } from '@/features/jobs/jobsSlice';
import { assignJobLocalFirst, createJob, editJob } from '@/features/jobs/jobsThunks';
import teamReducer, { usersHydrated } from '@/features/teamlead/teamSlice';
import { chooseCalendarDate } from './date-picker-helpers';
import type { ApiJob } from '@/types/api';
import type { AssignmentActor, Job, Role } from '@/types/domain';

function makeStore() {
  return configureStore({
    reducer: { auth: authReducer, jobs: jobsReducer, team: teamReducer, api: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

const session = { userId: '1', name: 'Manager', role: 'Manager' as const, accessToken: 'test-token' };
const input = {
  siteName: 'Offline building', siteAddress: '10 Offline Street',
  scheduledDate: '2026-12-01', notes: 'Offline comments', assignedSurveyorId: null,
};
const serverJob: ApiJob = {
  id: 51, jobRef: 'MDU-000051', siteName: input.siteName, siteAddress: input.siteAddress,
  scheduledDate: input.scheduledDate, status: 'YetToAssign', assigneeName: null,
};
let store: ReturnType<typeof makeStore>;
let stores: ReturnType<typeof makeStore>[];
let requests: { method: string; url: string; body: Record<string, unknown>; key?: string }[];

function online(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await authRepo.set(session);
  online(false);
  store = makeStore();
  stores = [store];
  await runHydrators(store.dispatch);
  requests = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    requests.push({
      url, method: init?.method ?? 'GET', body,
      key: new Headers(init?.headers).get('Idempotency-Key') ?? undefined,
    });
    if (init?.method === 'POST' || init?.method === 'PUT' || init?.method === 'PATCH') {
      return Response.json({ ...serverJob, ...body });
    }
    if (url === '/api/jobs') return Response.json([serverJob]);
    return Response.json([]);
  }));
});

afterEach(() => {
  for (const item of stores) item.dispatch(baseApi.util.resetApiState());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function reload() {
  const fresh = makeStore();
  stores.push(fresh);
  await runHydrators(fresh.dispatch);
  return fresh;
}

// Seed writes made by older releases to exercise the still-supported outbox.
const seedLegacyCreate = (details: Omit<typeof input, 'assignedSurveyorId'> & {
  latitude?: number; longitude?: number; assignedSurveyorId?: number | null;
}) => async (dispatch: typeof store.dispatch, getState: typeof store.getState) => {
  const { userId, role, name } = getState().auth;
  const actor = { userId: userId!, role: role! };
  const id = crypto.randomUUID();
  const createdDate = new Date().toISOString();
  const job = await jobsRepo.saveLocal({
    id, clientId: id, siteName: details.siteName, address: details.siteAddress,
    latitude: details.latitude, longitude: details.longitude,
    scheduledDate: details.scheduledDate, createdDate, createdByName: name ?? undefined,
    createdBy: actor, status: 'new', attempt: 0, assignmentHistory: [],
    assignedTo: details.assignedSurveyorId == null ? undefined
      : { userId: String(details.assignedSurveyorId), role: 'TeamLead' },
    siteDetails: { notes: details.notes }, updatedAt: createdDate, dirty: true, syncStatus: 'pending',
  }, {}, true);
  dispatch(jobUpserted(job));
  return job;
};

const seedLegacyEdit = (details: typeof input & { id: string; assignedTo?: AssignmentActor | null }) =>
  async (dispatch: typeof store.dispatch, getState: typeof store.getState) => {
    const job = selectJobById(getState(), details.id)!;
    const { userId, role } = getState().auth;
    const updatedDate = new Date().toISOString();
    const saved = await jobsRepo.saveLocal({
      ...job,
      siteName: details.siteName,
      address: details.siteAddress,
      latitude: job.address === details.siteAddress ? job.latitude : undefined,
      longitude: job.address === details.siteAddress ? job.longitude : undefined,
      scheduledDate: details.scheduledDate,
      updatedDate,
      pendingEditBy: { userId: userId!, role: role! },
      assignedTo: details.assignedTo === undefined ? job.assignedTo : details.assignedTo ?? undefined,
      siteDetails: { ...job.siteDetails, notes: details.notes },
    }, {
      siteName: details.siteName, siteAddress: details.siteAddress, scheduledDate: details.scheduledDate,
      comments: details.notes, updatedDate,
      ...(details.assignedTo !== undefined
        ? { assignedSurveyorId: details.assignedTo ? Number(details.assignedTo.userId) : null } : {}),
    });
    dispatch(jobUpserted(saved));
    return saved;
  };

describe('persistent job outbox and server metadata', () => {
  it('retains selected coordinates through offline reload, create payload and server refresh', async () => {
    const coordinates = { latitude: -33.9715161, longitude: 150.9277573 };
    const local = await store.dispatch(seedLegacyCreate({ ...input, ...coordinates }));
    const fresh = await reload();
    expect(selectJobById(fresh.getState(), local.id)).toMatchObject(coordinates);
    online(true);
    // The backend may omit coordinates in the response; retain the selected values.
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(serverJob));
    await fresh.dispatch(syncPendingJobs());
    const post = vi.mocked(fetch).mock.calls[0];
    expect(post[0]).toBe('/api/job/create_job');
    expect(JSON.parse(String(post[1]?.body))).toMatchObject(coordinates);
    expect(selectJobById((await reload()).getState(), '51')).toMatchObject(coordinates);
    await fresh.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
    expect(await jobsRepo.getById('51')).toMatchObject(coordinates);
  });

  it('omits coordinates for manual addresses, including edits to a pending creation', async () => {
    const local = await store.dispatch(seedLegacyCreate({
      ...input, latitude: -33.9715161, longitude: 150.9277573,
    }));
    await store.dispatch(seedLegacyEdit({
      id: local.id, ...input, siteAddress: 'Different manual address',
    }));
    online(true);
    await (await reload()).dispatch(syncPendingJobs());
    expect(requests[0].body).not.toHaveProperty('latitude');
    expect(requests[0].body).not.toHaveProperty('longitude');
  });

  it.each([
    ['2026-11-16T23:30:00.000Z', '2026-11-18T00:30:00+05:30'],
    ['2026-11-16', '2026-11-18'],
  ])('sends audit dates without time on create and update (%s)', async (createdDate, updatedDate) => {
    await store.dispatch(baseApi.endpoints.createJob.initiate({
      siteName: input.siteName, siteAddress: input.siteAddress,
      scheduledDate: input.scheduledDate, comments: input.notes,
      assignedSurveyorId: null, createdDate, updatedDate,
    })).unwrap();
    expect(requests[0].body).toMatchObject({
      createdDate: '2026-11-16', updatedDate: '2026-11-18',
      scheduledDate: input.scheduledDate,
    });
    await store.dispatch(baseApi.endpoints.updateJob.initiate({
      id: '51', updatedDate, assignedSurveyorId: null,
    })).unwrap();
    expect(requests[1].body).toEqual({ updatedDate: '2026-11-18', assignedSurveyorId: null });
  });

  it('omits the update date when an update request has none', async () => {
    await store.dispatch(baseApi.endpoints.updateJob.initiate({
      id: '51', comments: 'New comments', assignedSurveyorId: null,
    })).unwrap();
    expect(requests[0].body).toEqual({ comments: 'New comments', assignedSurveyorId: null });
  });

  it('rejects an update without an assignment or cached job instead of guessing', async () => {
    await expect(store.dispatch(baseApi.endpoints.updateJob.initiate({
      id: '51', comments: 'New comments',
    })).unwrap()).rejects.toMatchObject({ status: 400 });
    expect(requests).toHaveLength(0);
  });

  it.each(['Manager', 'TeamLead'] as const)('creates offline as %s, survives reload and syncs once', async (role) => {
    await authRepo.set({ ...session, role });
    store.dispatch(authHydrated({ ...session, role }));
    const local = await store.dispatch(seedLegacyCreate(input));
    expect(local.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(local.syncStatus).toBe('pending');
    expect(local.createdDate).toBeTruthy();
    expect(new Date(local.createdDate!).toISOString()).toBe(local.createdDate);
    expect(local.updatedDate).toBeUndefined();
    expect(local.createdByName).toBe(session.name);
    expect(requests).toHaveLength(0);
    expect(await db.syncQueue.count()).toBe(1);
    const fresh = await reload();
    expect(selectJobById(fresh.getState(), local.id)).toEqual(local);
    online(true);
    await fresh.dispatch(syncPendingJobs());
    await fresh.dispatch(syncPendingJobs());
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST', url: '/api/job/create_job',
      body: {
        siteName: input.siteName, comments: input.notes, assignedSurveyorId: null,
        createdDate: local.createdDate!.split('T')[0],
        createdBy: session.name,
      },
    });
    expect(requests[0].body).not.toHaveProperty('updatedDate');
    expect(requests[0].key).toBeTruthy();
    expect(await db.syncQueue.count()).toBe(0);
    expect(await jobsRepo.getById(local.id)).toBeUndefined();
    const saved = await jobsRepo.getById('51');
    expect(saved).toMatchObject({ dirty: false, syncStatus: 'synced', createdBy: { role }, clientId: local.id });
    expect(saved?.createdDate).toBe(local.createdDate!.split('T')[0]);
    expect(saved?.createdByName).toBe(session.name);
    expect(saved?.updatedDate).toBeUndefined();
    expect(selectAllJobs(fresh.getState())).toHaveLength(1);
    expect(selectJobById((await reload()).getState(), '51')).toEqual(saved);
  });

  it('coalesces edits and unassignment into an offline creation', async () => {
    store.dispatch(usersHydrated([{ id: '8', name: 'Lead', role: 'TeamLead' }]));
    const local = await store.dispatch(seedLegacyCreate({ ...input, assignedSurveyorId: 8 }));
    const edited = await store.dispatch(seedLegacyEdit({
      id: local.id, ...input, siteName: 'Latest building', assignedTo: null,
    }));
    expect(edited.createdDate).toBe(local.createdDate);
    expect(edited.updatedDate).toBeTruthy();
    expect(await db.syncQueue.count()).toBe(1);
    online(true);
    await store.dispatch(syncPendingJobs());
    expect(requests).toHaveLength(1);
    expect(requests[0].body).toMatchObject({
      siteName: 'Latest building', assignedSurveyorId: null,
      createdDate: local.createdDate!.split('T')[0], updatedDate: edited.updatedDate!.split('T')[0],
      createdBy: session.name,
    });
    expect((await jobsRepo.getById('51'))?.siteName).toBe('Latest building');
    expect(selectJobById((await reload()).getState(), '51')).toMatchObject({
      createdDate: local.createdDate!.split('T')[0], updatedDate: edited.updatedDate!.split('T')[0],
      createdByName: session.name,
    });
  });

  it('keeps the original creator name when the session name changes before sync', async () => {
    const local = await store.dispatch(seedLegacyCreate(input));
    const renamedSession = { ...session, name: 'Renamed Manager' };
    await authRepo.set(renamedSession);
    store.dispatch(authHydrated(renamedSession));
    const edited = await store.dispatch(seedLegacyEdit({
      id: local.id, ...input, siteName: 'Edited building',
    }));
    expect(edited.createdByName).toBe(session.name);
    online(true);
    await (await reload()).dispatch(syncPendingJobs());
    expect(requests).toHaveLength(1);
    expect(requests[0].body.createdBy).toBe(session.name);
    expect(selectJobById((await reload()).getState(), '51')?.createdByName).toBe(session.name);
  });

  it('shows the create response creator name on the dashboard card and retains it after refresh and reload', async () => {
    online(true);
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({
      ...serverJob, createdByName: 'Backend Creator',
    }));
    const saved = await store.dispatch(createJob(input)).unwrap();
    expect(saved.createdByName).toBe('Backend Creator');
    await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
    const restored = selectJobById((await reload()).getState(), '51')!;
    expect(restored.createdByName).toBe('Backend Creator');
    render(
      <MemoryRouter>
        <JobCard job={restored} detailsPath="/manager/jobs/51"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Created by: Backend Creator')).toBeDefined();
    expect(screen.queryByText(`Created by: ${session.name}`)).toBeNull();
  });

  it.each(['list', 'detail'] as const)('loads job dates and creator from a fresh backend %s response', async (source) => {
    online(true);
    const dates = { createdDate: '2026-10-20T09:30:00Z', updatedDate: '2026-11-16T09:30:00Z' };
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(source === 'list'
      ? [{ ...serverJob, ...dates, createdByName: 'Backend Creator' }]
      : { ...serverJob, ...dates, createdByName: 'Backend Creator' }));
    if (source === 'list') {
      await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
    } else {
      await store.dispatch(baseApi.endpoints.getJob.initiate('51')).unwrap();
    }
    expect(selectJobById((await reload()).getState(), '51')).toMatchObject(dates);
    expect(selectJobById(store.getState(), '51')?.createdByName).toBe('Backend Creator');
  });

  it('retains creation and edit dates when responses omit them, including after reload', async () => {
    const local = await store.dispatch(seedLegacyCreate(input));
    online(true);
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(serverJob));
    await store.dispatch(syncPendingJobs());
    expect((await jobsRepo.getById('51'))?.createdDate).toBe(local.createdDate);
    expect((await jobsRepo.getById('51'))?.createdByName).toBe(session.name);
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(serverJob));
    const edited = await store.dispatch(editJob({ id: '51', ...input })).unwrap();
    expect(edited.createdDate).toBe(local.createdDate);
    expect(edited.updatedDate).toBeTruthy();
    await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
    const fresh = await reload();
    expect(selectJobById(fresh.getState(), '51')).toMatchObject({
      createdDate: local.createdDate, updatedDate: edited.updatedDate,
      createdByName: session.name,
    });
  });

  it('records each edit save time without replacing the creation date or using the sync time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-11-16T08:00:00Z'));
      const local = await store.dispatch(seedLegacyCreate(input));
      expect(local.createdDate).toBe('2026-11-16T08:00:00.000Z');
      vi.setSystemTime(new Date('2026-11-17T09:00:00Z'));
      await store.dispatch(seedLegacyEdit({ id: local.id, ...input, siteName: 'First edit' }));
      vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
      const edited = await store.dispatch(seedLegacyEdit({
        id: local.id, ...input, siteName: 'Latest edit',
      }));
      expect(edited.updatedDate).toBe('2026-11-18T10:00:00.000Z');
      expect(edited.createdDate).toBe(local.createdDate);
      vi.setSystemTime(new Date('2026-11-19T11:00:00Z'));
      online(true);
      await (await reload()).dispatch(syncPendingJobs());
      expect(requests[0].body).toMatchObject({
        createdDate: '2026-11-16',
        updatedDate: '2026-11-18',
      });
      expect(selectJobById((await reload()).getState(), '51')).toMatchObject({
        createdDate: '2026-11-16', updatedDate: '2026-11-18',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('updates existing jobs offline and preserves them through a server refresh', async () => {
    online(true);
    await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
    online(false);
    const changed = await store.dispatch(seedLegacyEdit({
      id: '51', ...input, siteName: 'Changed offline', assignedTo: null,
    }));
    expect(changed.dirty).toBe(true);
    expect(changed.updatedDate).toBeTruthy();
    const fresh = await reload();
    expect(selectJobById(fresh.getState(), '51')?.updatedDate).toBe(changed.updatedDate);
    online(true);
    await fresh.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
    expect(selectJobById(fresh.getState(), '51')?.siteName).toBe('Changed offline');
    await fresh.dispatch(syncPendingJobs());
    expect(requests.filter((request) => request.method === 'PUT')).toEqual([
      expect.objectContaining({
        url: '/api/job/update_job/51',
        body: expect.objectContaining({
          siteName: 'Changed offline', assignedSurveyorId: null,
          updatedDate: changed.updatedDate!.split('T')[0],
        }),
      }),
    ]);
    expect((await jobsRepo.getById('51'))?.dirty).toBe(false);
    expect((await jobsRepo.getById('51'))?.updatedDate).toBe(changed.updatedDate!.split('T')[0]);
  });

  it('includes the cached assignment when a legacy queued edit syncs after reload', async () => {
    online(true);
    await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
    const job = selectJobById(store.getState(), '51')!;
    const assigned = { ...job, assignedTo: { userId: '8', role: 'TeamLead' as const }, assigneeName: 'Lead' };
    await jobsRepo.upsert(assigned);
    store.dispatch(jobUpserted(assigned));
    online(false);
    await store.dispatch(seedLegacyEdit({ id: '51', ...input, siteName: 'Queued edit' }));
    const fresh = await reload();
    online(true);
    await fresh.dispatch(syncPendingJobs());
    expect(requests.find((request) => request.method === 'PUT')?.body).toMatchObject({
      siteName: 'Queued edit', assignedSurveyorId: 8,
    });
    expect((await jobsRepo.getById('51'))?.dirty).toBe(false);
  });

  it('retains a legacy queued edit if its assignment ID is unknown', async () => {
    online(true);
    await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
    const job = selectJobById(store.getState(), '51')!;
    const nameOnly = { ...job, assignedTo: undefined, assigneeName: 'Lead' };
    await jobsRepo.upsert(nameOnly);
    store.dispatch(jobUpserted(nameOnly));
    online(false);
    await store.dispatch(seedLegacyEdit({ id: '51', ...input, siteName: 'Queued edit' }));
    const fresh = await reload();
    online(true);
    await fresh.dispatch(syncPendingJobs());
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(0);
    expect(await jobsRepo.getById('51')).toMatchObject({
      siteName: 'Queued edit', dirty: true, syncStatus: 'failed',
      syncError: expect.stringContaining('not found in the roster'),
    });
    expect(await db.syncQueue.count()).toBe(1);
  });

  it('resolves a name-only assignment when syncing a legacy queued edit', async () => {
    online(true);
    await store.dispatch(baseApi.endpoints.getJobs.initiate()).unwrap();
    const job = selectJobById(store.getState(), '51')!;
    const nameOnly = { ...job, assignedTo: undefined, assigneeName: 'Lead' };
    await jobsRepo.upsert(nameOnly);
    store.dispatch(jobUpserted(nameOnly));
    online(false);
    await store.dispatch(seedLegacyEdit({ id: '51', ...input, siteName: 'Queued edit' }));
    const fresh = await reload();
    online(true);
    const originalFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (url === '/api/user/team') {
        return Response.json([{ id: 8, displayName: 'Lead', email: 'lead@example.test', isActive: true }]);
      }
      return originalFetch(url, init);
    });
    await fresh.dispatch(syncPendingJobs());
    expect(requests.find((request) => request.method === 'PUT')?.body.assignedSurveyorId).toBe(8);
    expect((await jobsRepo.getById('51'))?.assignedTo).toEqual({ userId: '8', role: 'TeamLead' });
    expect((await jobsRepo.getById('51'))?.dirty).toBe(false);
  });

  it('queues assignment made through the reassign control', async () => {
    online(true);
    const job = await store.dispatch(createJob(input)).unwrap();
    online(false);
    store.dispatch(usersHydrated([{ id: '8', name: 'Lead', role: 'TeamLead' }]));
    await store.dispatch(assignJobLocalFirst({
      job, actor: { userId: '1', role: 'Manager' }, assignedTo: { userId: '8', role: 'TeamLead' },
    })).unwrap();
    expect(requests).toHaveLength(1);
    online(true);
    await (await reload()).dispatch(syncPendingJobs());
    expect(requests.at(-1)).toMatchObject({
      method: 'PATCH',
      url: '/api/job/reassign_job/51',
      body: { assignedSurveyorId: 8 },
    });
    expect((await jobsRepo.getById('51'))?.assignedTo?.role).toBe('TeamLead');
    expect((await jobsRepo.getById('51'))?.createdDate).toBe(job.createdDate);
    expect((await jobsRepo.getById('51'))?.updatedDate).toBeUndefined();
  });

  it('keeps network failures pending, respects backoff and retries without losing data', async () => {
    const local = await store.dispatch(seedLegacyCreate(input));
    online(true);
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Network unavailable'));
    await store.dispatch(syncPendingJobs());
    const queued = await db.syncQueue.toCollection().first();
    expect(queued).toMatchObject({ status: 'pending', attempts: 1 });
    expect((await jobsRepo.getById(local.id))?.syncError).toContain('Unable to reach the server');
    await store.dispatch(syncPendingJobs());
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.spyOn(Date, 'now').mockReturnValue(queued!.nextAttemptAt);
    await store.dispatch(syncPendingJobs());
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('shows permanent backend errors without offering manual retry', async () => {
    await store.dispatch(seedLegacyCreate(input));
    online(true);
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ message: 'Date is not allowed' }, { status: 400 }));
    await store.dispatch(syncPendingJobs());
    expect((await db.syncQueue.toArray())[0].status).toBe('failed');
    await store.dispatch(syncPendingJobs());
    expect(fetch).toHaveBeenCalledTimes(1);
    render(<Provider store={store}><ConnectionPill /></Provider>);
    expect(screen.getByRole('alert').textContent).toContain('Date is not allowed');
    expect(screen.queryByRole('button', { name: 'Retry sync' })).toBeNull();
    await store.dispatch(syncPendingJobs());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await db.syncQueue.toArray())[0].status).toBe('failed');
  });

  it('freezes a retried POST body and sends newer edits with PUT after the response', async () => {
    const local = await store.dispatch(seedLegacyCreate(input));
    online(true);
    const realFetch = vi.mocked(fetch).getMockImplementation()!;
    let committedBody: string | undefined;
    let committedKey: string | null = null;
    vi.mocked(fetch).mockImplementationOnce(async (_url, init) => {
      committedBody = String(init?.body);
      committedKey = new Headers(init?.headers).get('Idempotency-Key');
      throw new TypeError('Response lost after server committed');
    });
    await store.dispatch(syncPendingJobs());
    online(false);
    const edited = await store.dispatch(seedLegacyEdit({
      id: local.id, ...input, siteName: 'Newer edit',
    }));
    online(true);
    vi.mocked(fetch).mockImplementationOnce(async (_url, init) => {
      expect(String(init?.body)).toBe(committedBody);
      expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(committedKey);
      return Response.json(serverJob);
    }).mockImplementation(realFetch);
    await store.dispatch(syncPendingJobs());
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'PUT', body: { siteName: 'Newer edit', updatedDate: edited.updatedDate!.split('T')[0] },
    });
    expect(await jobsRepo.getAll()).toHaveLength(1);
    expect((await jobsRepo.getById('51'))?.siteName).toBe('Newer edit');
    expect((await jobsRepo.getById('51'))?.createdDate).toBe(local.createdDate);
    expect((await jobsRepo.getById('51'))?.updatedDate).toBe(edited.updatedDate!.split('T')[0]);
  });

  it('does not lose an edit made while a creation is in flight or submit duplicate requests', async () => {
    const local = await store.dispatch(seedLegacyCreate(input));
    online(true);
    let release!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const syncing = store.dispatch(syncPendingJobs());
    await waitFor(() => expect(release).toBeDefined());
    await store.dispatch(syncPendingJobs());
    await store.dispatch(seedLegacyEdit({ id: local.id, ...input, notes: 'Edited during POST' }));
    release(Response.json(serverJob));
    await syncing;
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(requests[0]).toMatchObject({ method: 'PUT', body: { comments: 'Edited during POST' } });
    expect(selectAllJobs(store.getState())).toHaveLength(1);
    expect((await jobsRepo.getById('51'))?.siteDetails.notes).toBe('Edited during POST');
  });

  it('keeps temporary edit links working after the backend ID replaces the UUID', async () => {
    const local = await store.dispatch(seedLegacyCreate(input));
    online(true);
    await store.dispatch(syncPendingJobs());
    const fresh = await reload();
    expect(selectJobById(fresh.getState(), local.id)?.id).toBe('51');
    await fresh.dispatch(editJob({ id: local.id, ...input, notes: 'Saved through old link' })).unwrap();
    expect(requests.at(-1)).toMatchObject({
      method: 'PUT', url: '/api/job/update_job/51', body: { comments: 'Saved through old link' },
    });
    expect(await jobsRepo.getAll()).toHaveLength(1);
  });

  it('preserves newer edits when an older update response arrives', async () => {
    online(true);
    await store.dispatch(createJob(input)).unwrap();
    online(false);
    await store.dispatch(seedLegacyEdit({ id: '51', ...input, notes: 'First update' }));
    online(true);
    let release!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const syncing = store.dispatch(syncPendingJobs());
    await waitFor(() => expect(release).toBeDefined());
    await store.dispatch(seedLegacyEdit({ id: '51', ...input, notes: 'Newest update' }));
    release(Response.json({ ...serverJob, comments: 'First update' }));
    await syncing;
    expect(requests.at(-1)).toMatchObject({ method: 'PUT', body: { comments: 'Newest update' } });
    expect((await jobsRepo.getById('51'))?.siteDetails.notes).toBe('Newest update');
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('backs off after a server error rather than discarding or hot-looping the job', async () => {
    const local = await store.dispatch(seedLegacyCreate(input));
    online(true);
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ message: 'Server unavailable' }, { status: 503 }));
    await store.dispatch(syncPendingJobs());
    expect((await jobsRepo.getById(local.id))?.dirty).toBe(true);
    expect((await db.syncQueue.toArray())[0]).toMatchObject({
      status: 'pending', attempts: 1, lastError: 'Server unavailable',
    });
    await store.dispatch(syncPendingJobs());
    expect(fetch).toHaveBeenCalledTimes(1);
    const queued = (await db.syncQueue.toArray())[0];
    vi.spyOn(Date, 'now').mockReturnValue(queued.nextAttemptAt);
    await store.dispatch(syncPendingJobs());
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('prevents a second store from sending an already-claimed request', async () => {
    await store.dispatch(seedLegacyCreate(input));
    const second = await reload();
    online(true);
    let release!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const syncing = store.dispatch(syncPendingJobs());
    await waitFor(() => expect(release).toBeDefined());
    await second.dispatch(syncPendingJobs());
    expect(fetch).toHaveBeenCalledTimes(1);
    release(Response.json(serverJob));
    await syncing;
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('does not erase a newly synced job when an older list request returns late', async () => {
    const local = await store.dispatch(seedLegacyCreate(input));
    online(true);
    let release!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const listing = store.dispatch(baseApi.endpoints.getJobs.initiate());
    await waitFor(() => expect(release).toBeDefined());
    await store.dispatch(syncPendingJobs());
    release(Response.json([]));
    await listing.unwrap();
    expect(await db.syncQueue.count()).toBe(0);
    expect(await jobsRepo.getById('51')).toMatchObject({ clientId: local.id, dirty: false });
    expect(selectAllJobs(store.getState())).toHaveLength(1);
  });

  it('recovers an interrupted inflight request after its lease expires', async () => {
    await store.dispatch(seedLegacyCreate(input));
    const queued = (await db.syncQueue.toArray())[0];
    await db.syncQueue.update(queued.seq!, { status: 'inflight', nextAttemptAt: Date.now() - 1 });
    const fresh = await reload();
    online(true);
    await fresh.dispatch(syncPendingJobs());
    expect(requests).toHaveLength(1);
    expect(await db.syncQueue.count()).toBe(0);
  });

  it('does not replay another account’s writes', async () => {
    await store.dispatch(seedLegacyCreate(input));
    await authRepo.set({ ...session, userId: '99' });
    store.dispatch(authHydrated({ ...session, userId: '99' }));
    online(true);
    await store.dispatch(syncPendingJobs());
    expect(requests).toHaveLength(0);
    expect(await db.syncQueue.count()).toBe(1);
  });

  it.each(['Surveyor', 'QC', 'Designer'] as Role[])('rejects offline creation for %s', async (role) => {
    store.dispatch(authHydrated({ ...session, role }));
    await expect(store.dispatch(createJob(input)).unwrap()).rejects.toContain('not permitted');
    expect(await db.syncQueue.count()).toBe(0);
    expect(await jobsRepo.getAll()).toHaveLength(0);
  });

  it('does not project a local write into Redux when its transaction fails', async () => {
    vi.spyOn(db.syncQueue, 'put').mockRejectedValueOnce(new Error('Storage full'));
    await expect(store.dispatch(seedLegacyCreate(input))).rejects.toMatchObject({ message: 'Storage full' });
    expect(selectAllJobs(store.getState())).toHaveLength(0);
    expect(await jobsRepo.getAll()).toHaveLength(0);
  });
});

describe('offline lifecycle and schema', () => {
  it('syncs on online and visibility events and on mounting after reload', async () => {
    await store.dispatch(seedLegacyCreate(input));
    const fresh = await reload();
    const view = render(<Provider store={fresh}><JobSyncLifecycle /></Provider>);
    expect(requests).toHaveLength(0);
    online(true);
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(async () => expect(await db.syncQueue.count()).toBe(0));
    online(false);
    await act(async () => { await fresh.dispatch(seedLegacyEdit({ id: '51', ...input, notes: 'Visible edit' })); });
    online(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(async () => expect(await db.syncQueue.count()).toBe(0));
    view.unmount();
    online(false);
    await fresh.dispatch(seedLegacyEdit({ id: '51', ...input, notes: 'Startup edit' }));
    online(true);
    render(<Provider store={await reload()}><JobSyncLifecycle /></Provider>);
    await waitFor(async () => expect(await db.syncQueue.count()).toBe(0));
    expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(2);
  });

  it('blocks offline creation, retains form input, and only saves after an online retry', async () => {
    render(<Provider store={store}>
      <MemoryRouter initialEntries={['/manager/jobs/new']}>
        <Routes>
          <Route path="/manager/jobs/new" element={<CreateJobPage backPath="/done" />} />
          <Route path="/done" element={<p>Saved destination</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>);
    fireEvent.change(screen.getByLabelText(/Site\/Job Name/), { target: { value: input.siteName } });
    fireEvent.change(screen.getByLabelText(/Site Address/), { target: { value: input.siteAddress } });
    await chooseCalendarDate(screen.getByLabelText(/Scheduled Date/), input.scheduledDate);
    fireEvent.click(screen.getByRole('button', { name: 'Create Job' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Connect to the internet to create a job');
    expect((screen.getByLabelText(/Site\/Job Name/) as HTMLInputElement).value).toBe(input.siteName);
    expect(await jobsRepo.getAll()).toHaveLength(0);
    expect(await db.syncQueue.count()).toBe(0);
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);
    online(true);
    fireEvent.click(screen.getByRole('button', { name: 'Create Job' }));
    await screen.findByText('Saved destination');
    expect(await jobsRepo.getById('51')).toMatchObject({ siteName: input.siteName, dirty: false });
  });

  it.each([false, true])('uses selected address coordinates and clears them on text edits (%s)', async (editAddress) => {
    online(true);
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url).startsWith('https://photon.komoot.io/api/')) {
        return Response.json({ features: [{
          geometry: { type: 'Point', coordinates: [150.9277573, -33.9715161] },
          properties: {
            osm_id: 1, street: 'Green Hills Road', district: 'Holsworthy',
            state: 'New South Wales', postcode: '2173', countrycode: 'AU',
          },
        }] });
      }
      if (init?.method === 'POST') {
        return Response.json({ ...serverJob, ...JSON.parse(String(init.body)) });
      }
      return Response.json([]);
    });
    render(<Provider store={store}>
      <MemoryRouter initialEntries={['/manager/jobs/new']}>
        <Routes>
          <Route path="/manager/jobs/new" element={<CreateJobPage backPath="/done" />} />
          <Route path="/done" element={<p>Saved destination</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>);
    fireEvent.change(screen.getByLabelText(/Site\/Job Name/), { target: { value: input.siteName } });
    await chooseCalendarDate(screen.getByLabelText(/Scheduled Date/), input.scheduledDate);
    fireEvent.change(screen.getByLabelText(/Site Address/), { target: { value: 'Green Hills' } });
    fireEvent.click(await screen.findByRole('option', { name: /Green Hills Road/ }));
    if (editAddress) {
      fireEvent.change(screen.getByLabelText(/Site Address/), { target: { value: 'Manual address' } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Create Job' }));
    await screen.findByText('Saved destination');
    const local = (await jobsRepo.getAll())[0];
    if (editAddress) {
      expect(local.latitude).toBeUndefined();
      expect(local.longitude).toBeUndefined();
    } else {
      expect(local).toMatchObject({
        address: 'Green Hills Road, Holsworthy NSW 2173',
        latitude: -33.9715161, longitude: 150.9277573,
      });
    }
    const post = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST');
    const payload = JSON.parse(String(post?.[1]?.body));
    if (editAddress) {
      expect(payload).not.toHaveProperty('latitude');
      expect(payload).not.toHaveProperty('longitude');
    } else {
      expect(payload).toMatchObject({ latitude: -33.9715161, longitude: 150.9277573 });
    }
  });

  it('upgrades v1 dirty jobs into the indexed outbox without losing existing data', async () => {
    const dirty: Job = {
      id: '12', siteName: input.siteName, address: input.siteAddress, status: 'new',
      scheduledDate: input.scheduledDate, createdBy: { userId: '1', role: 'Manager' },
      siteDetails: { notes: input.notes }, assignmentHistory: [], attempt: 0,
      updatedAt: new Date().toISOString(), dirty: true, syncStatus: 'failed',
    };
    await db.delete();
    const legacy = new Dexie('mdu-survey');
    legacy.version(1).stores({
      jobs: 'id, status, assignedTo.userId, createdBy.userId, updatedAt',
      users: 'id, role, teamLeadId', teams: 'teamLeadUserId',
      surveySessions: 'jobId', authSession: 'id',
    });
    await legacy.table('jobs').put(dirty);
    await legacy.table('authSession').put({ ...session, id: 'current' });
    legacy.close();
    await db.open();
    expect(await jobsRepo.getById('12')).toEqual(dirty);
    expect((await db.syncQueue.toArray())[0]).toMatchObject({
      entityId: '12', kind: 'update', owner: { userId: '1', role: 'Manager' },
      changes: { comments: input.notes, assignedSurveyorId: null },
    });
    expect(db.syncQueue.schema.indexes.map((index) => index.name))
      .toEqual(expect.arrayContaining(['status', 'entity', '[entity+entityId]']));
    await (await reload()).dispatch(syncPendingJobs());
    expect(requests).toHaveLength(0);
  });
});
