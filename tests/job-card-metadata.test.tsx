import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/api/baseApi';
import { db } from '@/data/db/schema';
import { runHydrators } from '@/data/hydration/registry';
import { authRepo } from '@/data/repos/authRepo';
import authReducer, { authHydrated } from '@/features/auth/authSlice';
import { JobCard } from '@/features/jobs/components/JobCard';
import { JobDetailsPage } from '@/features/jobs/JobDetailsPage';
import jobsReducer, { selectJobById } from '@/features/jobs/jobsSlice';
import { ManagerDashboardPage } from '@/features/manager/ManagerDashboardPage';
import teamReducer from '@/features/teamlead/teamSlice';
import type { ApiJob } from '@/types/api';
import type { Job } from '@/types/domain';

function makeStore() {
  return configureStore({
    reducer: { auth: authReducer, jobs: jobsReducer, team: teamReducer, api: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

const session = { userId: '1', name: 'Manager', role: 'Manager' as const, accessToken: 'test-token' };
const listJob: ApiJob = {
  id: 21, jobRef: 'MDU-000021', siteName: 'Metadata Site', siteAddress: '10 Original Street',
  status: 'YetToAssign', assigneeTeamLead: 'List Lead', latestSurveyorName: 'List Surveyor',
  scheduledDate: '2026-11-28', createdByName: 'List Creator', createdDate: '2026-10-20',
};
const missingMetadataJob: ApiJob = {
  id: 22, jobRef: 'MDU-000022', siteName: 'Other Site', siteAddress: '20 Other Street',
  status: 'YetToAssign', scheduledDate: null,
};
const localJob: Job = {
  id: '21', siteName: listJob.siteName, address: listJob.siteAddress, status: 'new',
  createdBy: { userId: '1', role: 'Manager' }, siteDetails: {},
  assignmentHistory: [], attempt: 0, updatedAt: '2026-11-01T00:00:00Z',
  dirty: false, syncStatus: 'synced',
};
let store: ReturnType<typeof makeStore>;
let stores: ReturnType<typeof makeStore>[];

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await authRepo.set(session);
  store = makeStore();
  stores = [store];
  store.dispatch(authHydrated(session));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/jobs') return Response.json([listJob, missingMetadataJob]);
    if (url === '/api/job/21') return Response.json({ ...listJob, createdByName: 'Detail Creator' });
    throw new Error(`Unexpected request: ${url}`);
  }));
});

afterEach(() => {
  for (const item of stores) item.dispatch(baseApi.util.resetApiState());
  vi.unstubAllGlobals();
});

describe('job card metadata loading', () => {
  it('reveals the full address on hover or focus and dismisses it with Escape', () => {
    const address = '10 A Very Long Street Address, Building 123, Example Town';
    render(
      <MemoryRouter>
        <JobCard job={{ ...localJob, address }} detailsPath="/" />
      </MemoryRouter>,
    );

    const addressText = screen.getByText(address);
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
    fireEvent.mouseEnter(addressText.parentElement!);
    expect(screen.getByRole('tooltip', { hidden: true }).textContent).toBe(address);
    fireEvent.mouseLeave(addressText.parentElement!);
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
    fireEvent.focus(addressText.parentElement!);
    expect(screen.getByRole('tooltip', { hidden: true }).textContent).toBe(address);
    fireEvent.keyDown(addressText.parentElement!, { key: 'Escape' });
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
    fireEvent.blur(addressText.parentElement!);
    fireEvent.focus(addressText.parentElement!);
    expect(screen.getByRole('tooltip', { hidden: true }).textContent).toBe(address);
  });

  it('renders list metadata without detail requests, and loads only the selected job on navigation', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<ManagerDashboardPage />} />
            <Route path="/dashboard/jobdetails/:jobRef" element={<JobDetailsPage backPath="/dashboard" />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );

    expect(await screen.findByText('List Creator')).toBeTruthy();
    expect(screen.getByText('20/10/2026')).toBeTruthy();
    expect(screen.getByTitle('Lead: List Lead')).toBeTruthy();
    expect(screen.getByTitle('Surveyor: List Surveyor')).toBeTruthy();
    const otherCard = screen.getByText('Other Site').closest('[class*="card"]')!;
    expect(within(otherCard).getAllByText('Not available')).toHaveLength(3);
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(['/api/jobs']);

    fireEvent.click(screen.getByRole('link', { name: 'View more details for Metadata Site' }));
    expect(await screen.findByText('Detail Creator')).toBeTruthy();
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/job/21')).toHaveLength(1));
    expect(vi.mocked(fetch).mock.calls.some(([url]) => url === '/api/job/22')).toBe(false);

    const fresh = makeStore();
    stores.push(fresh);
    await runHydrators(fresh.dispatch);
    expect(selectJobById(fresh.getState(), '21')?.createdByName).toBe('Detail Creator');
    expect(selectJobById(fresh.getState(), '22')?.siteName).toBe('Other Site');
  });

  it('uses available cached or supplied metadata without requesting details', () => {
    render(
      <MemoryRouter>
        <JobCard job={{ ...localJob, createdDate: '2026-10-20' }} createdByName="Known Creator" detailsPath="/" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Known Creator')).toBeTruthy();
    expect(screen.getByText('20/10/2026')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not request server details for an unsynced local job', () => {
    render(
      <MemoryRouter>
        <JobCard job={{ ...localJob, id: 'local-id', dirty: true, syncStatus: 'pending' }} detailsPath="/" />
      </MemoryRouter>,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows Overdue when the schedule has passed and the job is not submitted', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const scheduledDate = [
      yesterday.getFullYear(),
      String(yesterday.getMonth() + 1).padStart(2, '0'),
      String(yesterday.getDate()).padStart(2, '0'),
    ].join('-');
    render(
      <MemoryRouter>
        <JobCard job={{ ...localJob, dirty: true, syncStatus: 'pending', scheduledDate }} detailsPath="/" />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('Overdue')).toHaveLength(1);
    expect(screen.queryByText('Yet to Assign')).toBeNull();
  });
});
