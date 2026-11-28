import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/api/baseApi';
import { db } from '@/data/db/schema';
import { runHydrators } from '@/data/hydration/registry';
import { authRepo } from '@/data/repos/authRepo';
import { jobsRepo } from '@/data/repos/jobsRepo';
import authReducer, { authHydrated } from '@/features/auth/authSlice';
import { JobCard } from '@/features/jobs/components/JobCard';
import { JobDetailsPage } from '@/features/jobs/JobDetailsPage';
import jobsReducer, { jobsHydrated, selectJobById } from '@/features/jobs/jobsSlice';
import teamReducer from '@/features/teamlead/teamSlice';
import type { GetJobSiteInformationResponse } from '@/types/api';
import type { Job } from '@/types/domain';

function makeStore() {
  return configureStore({
    reducer: { auth: authReducer, jobs: jobsReducer, team: teamReducer, api: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

const job: Job = {
  id: '2', jobRef: 'MDU-000002', siteName: 'Dashboard site', address: 'Dashboard address',
  status: 'new', createdBy: { userId: '1', role: 'Manager' }, siteDetails: { notes: 'Keep comments' },
  assignmentHistory: [], attempt: 0, updatedAt: '2026-11-01T00:00:00Z',
  dirty: false, syncStatus: 'synced',
};
const response: GetJobSiteInformationResponse = {
  jobId: 2, siteId: 2, siteName: 'Green Field Apartments', siteAddress: 'Gachibowli, Telangana',
  placeId: null, latitude: 17.443622, longitude: 78.351964,
  buildingName: '', buildingTypeId: null, buildingType: null, groundClassId: null, ground: null,
  basementLevels: 0, floorsAboveGround: 0, eupCount: null, parkingAvailable: null,
  accessWindow: null, entryAccessInstructions: null, accessRequirements: null,
  contactName: null, contactEmail: null, contactPhone: null, contactRole: null,
};
const session = { userId: '1', name: 'Manager', role: 'Manager' as const, accessToken: 'test-token' };
let store: ReturnType<typeof makeStore>;
let failSiteRequest: boolean;
let siteResponse: GetJobSiteInformationResponse;
let siteRequests: string[];

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await authRepo.set(session);
  await jobsRepo.upsert(job);
  store = makeStore();
  store.dispatch(authHydrated(session));
  store.dispatch(jobsHydrated([job]));
  failSiteRequest = false;
  siteResponse = { ...response };
  siteRequests = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/site-information')) {
      siteRequests.push(url);
      return failSiteRequest
        ? Response.json({ message: 'Site service unavailable' }, { status: 503 })
        : Response.json(siteResponse);
    }
    const serverJob = {
      id: 2, jobRef: job.jobRef, siteName: job.siteName, siteAddress: job.address,
      status: 'YetToAssign', scheduledDate: null,
    };
    if (url === '/api/jobs') return Response.json([serverJob]);
    if (url === '/api/job/2') return Response.json(serverJob);
    throw new Error(`Unexpected request: ${url}`);
  }));
});

afterEach(() => {
  store.dispatch(baseApi.util.resetApiState());
  vi.unstubAllGlobals();
});

function renderDetails(initialPath = '/dashboard') {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/dashboard" element={<JobCard job={job} detailsPath="/dashboard/jobs/MDU-000002" />} />
          <Route path="/dashboard/jobs/:jobRef" element={<JobDetailsPage backPath="/dashboard" />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

function field(label: string) {
  return screen.getByText(label).parentElement!;
}

describe('dashboard site information', () => {
  it('requests the numeric job ID on View More, renders nullable fields and restores the response after reload', async () => {
    renderDetails();
    expect(siteRequests).toEqual([]);
    fireEvent.click(screen.getByRole('link', { name: 'View more details for Dashboard site' }));
    await screen.findByText(response.siteName);
    expect(siteRequests).toEqual(['/api/jobs/2/site-information']);
    expect(screen.getByText(response.siteAddress)).toBeDefined();
    expect(within(field('Basement levels')).getByText('0')).toBeDefined();
    expect(within(field('Floors')).getByText('GF')).toBeDefined();
    expect(within(field('Parking available')).getByText('—')).toBeDefined();
    expect(within(field('EUP')).getByText('—')).toBeDefined();
    const fresh = makeStore();
    await runHydrators(fresh.dispatch);
    const restored = selectJobById(fresh.getState(), '2');
    const { jobId, ...expectedSite } = response;
    expect(restored?.id).toBe(String(jobId));
    expect(restored?.siteInformation).toEqual(expectedSite);
    expect(restored?.siteDetails.notes).toBe('Keep comments');
    expect(restored?.dirty).toBe(false);
    fresh.dispatch(baseApi.util.resetApiState());
  });

  it('shows saved information on failure and retries with populated access and contact fields', async () => {
    const { jobId, ...saved } = response;
    await jobsRepo.saveSiteInformation(String(jobId), saved);
    await runHydrators(store.dispatch);
    failSiteRequest = true;
    renderDetails('/dashboard/jobs/MDU-000002');
    await screen.findByRole('alert');
    expect(screen.getByText(response.siteAddress)).toBeDefined();
    expect(screen.getByText(/Showing previously saved information/)).toBeDefined();
    failSiteRequest = false;
    siteResponse = {
      ...response, parkingAvailable: false, buildingName: 'Tower A', buildingType: 'Vertical',
      ground: 'Green field', basementLevels: 2, floorsAboveGround: 12, eupCount: 0,
      accessWindow: '09:00-17:00', entryAccessInstructions: 'Use gate 2',
      accessRequirements: 'Visitor pass', contactName: 'Site contact',
      contactEmail: 'contact@example.test', contactPhone: '1234567890', contactRole: 'Caretaker',
    };
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('Tower A');
    expect(within(field('Parking available')).getByText('No')).toBeDefined();
    expect(within(field('EUP')).getByText('0')).toBeDefined();
    expect(within(field('Floors')).getByText('B2 / B1 / GF / L1–12')).toBeDefined();
    for (const value of ['Vertical', 'Green field', 'Use gate 2', 'Visitor pass', 'Site contact',
      'contact@example.test', '1234567890', 'Caretaker']) {
      expect(screen.getByText(value)).toBeDefined();
    }
    expect(screen.queryByRole('alert')).toBeNull();
    expect(siteRequests).toHaveLength(2);
  });

  it('rejects a different job response without replacing previously saved information', async () => {
    siteResponse = { ...response, jobId: 99 };
    renderDetails('/dashboard/jobs/MDU-000002');
    await screen.findByRole('alert');
    await waitFor(() => expect(selectJobById(store.getState(), '2')?.siteInformation).toBeUndefined());
    expect((await jobsRepo.getById('2'))?.siteInformation).toBeUndefined();
    expect(screen.queryByText(response.siteName)).toBeNull();
  });
});
