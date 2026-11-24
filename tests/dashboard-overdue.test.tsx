import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/api/baseApi';
import authReducer, { authHydrated } from '@/features/auth/authSlice';
import jobsReducer, { jobsHydrated } from '@/features/jobs/jobsSlice';
import { ManagerDashboardPage } from '@/features/manager/ManagerDashboardPage';
import teamReducer from '@/features/teamlead/teamSlice';
import type { Job, JobStatus } from '@/types/domain';

vi.mock('@/api/baseApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/baseApi')>();
  return { ...actual, useGetJobsQuery: () => ({ isFetching: false }) };
});

function makeJob(siteName: string, status: JobStatus, scheduledDate?: string): Job {
  return {
    id: siteName,
    siteName,
    address: `Address for ${siteName}`,
    status,
    scheduledDate,
    createdBy: { userId: '1', role: 'Manager' },
    siteDetails: {},
    assignmentHistory: [],
    attempt: 0,
    updatedAt: '2026-11-01T00:00:00Z',
    dirty: false,
    syncStatus: 'synced',
  };
}

function renderDashboard(jobs: Job[], role: 'Manager' | 'TeamLead') {
  const store = configureStore({
    reducer: { auth: authReducer, jobs: jobsReducer, team: teamReducer, api: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
  store.dispatch(authHydrated({ userId: '1', name: 'User', role, accessToken: 'test-token' }));
  store.dispatch(jobsHydrated(jobs));
  render(<Provider store={store}><MemoryRouter><ManagerDashboardPage /></MemoryRouter></Provider>);
}

function tab(label: string, count: number) {
  const button = screen.getByRole('tab', { name: new RegExp(label) });
  expect(within(button).getByText(String(count))).toBeTruthy();
  return button;
}

function expectSites(names: string[]) {
  const links = screen.queryAllByRole('link', { name: /^View more details for / });
  expect(links.map((link) => link.getAttribute('aria-label'))).toEqual(
    names.map((name) => `View more details for ${name}`),
  );
}

describe('dashboard overdue status filters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 19, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(['Manager', 'TeamLead'] as const)(
    'excludes overdue new and assigned jobs from the matching tabs for %s',
    (role) => {
      const statuses = [
        ['New', 'new'],
        ['Lead', 'assigned_teamlead'],
        ['Surveyor', 'assigned_surveyor'],
      ] as const;
      const dates = [
        ['Past', '2026-11-18'],
        ['Today', '2026-11-19'],
        ['Future', '2026-11-20'],
        ['Missing', undefined],
      ] as const;
      const jobs = statuses.flatMap(([name, status]) =>
        dates.map(([when, date]) => makeJob(`${name} ${when}`, status, date)),
      );
      renderDashboard(jobs, role);

      tab('Total Sites', 12);
      tab('Yet to Assign', 3);
      tab('Not Started', 6);
      tab('Overdue', 3);
      expectSites(jobs.map((job) => job.siteName));

      fireEvent.click(tab('Yet to Assign', 3));
      expectSites(['New Today', 'New Future', 'New Missing']);
      fireEvent.click(tab('Not Started', 6));
      expectSites(['Lead Today', 'Lead Future', 'Lead Missing', 'Surveyor Today', 'Surveyor Future', 'Surveyor Missing']);
      fireEvent.click(tab('Overdue', 3));
      expectSites(['New Past', 'Lead Past', 'Surveyor Past']);
      fireEvent.click(tab('Total Sites', 12));
      expectSites(jobs.map((job) => job.siteName));
    },
  );

  it.each(['Manager', 'TeamLead'] as const)(
    'preserves other status filters, submitted and approved behavior for %s',
    (role) => {
      renderDashboard([
        makeJob('Progress Past', 'in_progress', '2026-11-18'),
        makeJob('QC Past', 'pending_qc', '2026-11-18'),
        makeJob('Returned Past', 'returned', '2026-11-18'),
        makeJob('Submitted Past', 'submitted', '2026-11-18'),
        makeJob('Approved Past', 'approved', '2026-11-18'),
      ], role);

      tab('Total Sites', 4);
      tab('In Progress', 1);
      tab('Pending QC', 2);
      tab('Returned', 1);
      // Approved jobs are excluded from lists and total, but currently contribute to the overdue count.
      tab('Overdue', 4);
      expectSites(['Progress Past', 'QC Past', 'Returned Past', 'Submitted Past']);
      fireEvent.click(tab('Overdue', 4));
      expectSites(['Progress Past', 'QC Past', 'Returned Past']);
      fireEvent.click(tab('In Progress', 1));
      expectSites(['Progress Past']);
      fireEvent.click(tab('Pending QC', 2));
      expectSites(['QC Past', 'Submitted Past']);
      fireEvent.click(tab('Returned', 1));
      expectSites(['Returned Past']);
    },
  );
});
