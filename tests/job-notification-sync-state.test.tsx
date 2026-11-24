import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/api/baseApi';
import { NotificationProvider } from '@/components/ui/NotificationProvider';
import authReducer, { authHydrated } from '@/features/auth/authSlice';
import { CreateJobPage } from '@/features/createJob/CreateJobPage';
import jobsReducer, { jobsHydrated } from '@/features/jobs/jobsSlice';
import teamReducer from '@/features/teamlead/teamSlice';
import type { Job } from '@/types/domain';
import { chooseCalendarDate } from './date-picker-helpers';

// Form-level presentation contract only: current create/edit thunks require a
// confirmed server response and cannot produce these local sync states.
const result = vi.hoisted(() => ({ job: undefined as Job | undefined }));
vi.mock('@/features/jobs/jobsThunks', async () => {
  const { createAsyncThunk } = await import('@reduxjs/toolkit');
  return {
    createJob: createAsyncThunk('test/create', async () => result.job!),
    editJob: createAsyncThunk('test/edit', async () => result.job!),
  };
});

function makeJob(syncStatus: Job['syncStatus']): Job {
  return {
    id: '21', jobRef: 'MDU-000021', siteName: 'Test site', address: '10 Test Street',
    scheduledDate: '2026-12-01', status: 'new',
    createdBy: { userId: '1', role: 'Manager' },
    siteDetails: { notes: 'Notes' }, assignmentHistory: [], attempt: 0,
    updatedAt: '2026-11-01T00:00:00Z', dirty: syncStatus !== 'synced', syncStatus,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('job outcome sync-state messaging (simulated thunk results)', () => {
  it.each([
    ['create', 'pending', 'status', 'Job created and saved on this device. Waiting to sync.'],
    ['create', 'failed', 'alert', 'Job created and saved on this device, but sync failed.'],
    ['update', 'pending', 'status', 'Job updated and saved on this device. Waiting to sync.'],
    ['update', 'failed', 'alert', 'Job updated and saved on this device, but sync failed.'],
  ] as const)('reports %s %s without claiming sync succeeded', async (action, syncStatus, role, message) => {
    result.job = makeJob(syncStatus);
    const store = configureStore({
      reducer: { auth: authReducer, jobs: jobsReducer, team: teamReducer, api: baseApi.reducer },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    });
    store.dispatch(authHydrated({ userId: '1', name: 'Manager', role: 'Manager', accessToken: 'token' }));
    store.dispatch(jobsHydrated([makeJob('synced')]));
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])));
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[action === 'create' ? '/new' : '/jobs/21/edit']}>
          <NotificationProvider>
            <Routes>
              <Route path="/new" element={<CreateJobPage backPath="/done" />} />
              <Route path="/jobs/:id/edit" element={<CreateJobPage backPath="/done" />} />
              <Route path="/done" element={<p>Destination</p>} />
            </Routes>
          </NotificationProvider>
        </MemoryRouter>
      </Provider>,
    );
    if (action === 'create') {
      fireEvent.change(screen.getByLabelText(/Site\/Job Name/), { target: { value: 'Test site' } });
      fireEvent.change(screen.getByLabelText(/Site Address/), { target: { value: '10 Test Street' } });
      await chooseCalendarDate(screen.getByLabelText(/Scheduled Date/), '2026-12-01');
    }
    fireEvent.click(screen.getByRole('button', { name: action === 'create' ? 'Create Job' : 'Update' }));
    await screen.findByText('Destination');
    const announcement = screen.getByText(message);
    expect(announcement.getAttribute('role')).toBe(role);
    expect(announcement.getAttribute('aria-atomic')).toBe('true');
    expect(screen.queryByText(/Job (created|updated) successfully/)).toBeNull();
    store.dispatch(baseApi.util.resetApiState());
  });
});
