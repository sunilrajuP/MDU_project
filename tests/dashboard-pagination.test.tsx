import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/api/baseApi';
import authReducer, { authHydrated } from '@/features/auth/authSlice';
import jobsReducer, { jobsHydrated } from '@/features/jobs/jobsSlice';
import { ManagerDashboardPage } from '@/features/manager/ManagerDashboardPage';
import teamReducer from '@/features/teamlead/teamSlice';
import type { Job } from '@/types/domain';

vi.mock('@/api/baseApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/baseApi')>();
  return { ...actual, useGetJobsQuery: () => ({ isFetching: false }) };
});

function makeJobs(count: number): Job[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `job-${index + 1}`,
    siteName: `Site ${index + 1}`,
    address: `Address ${index + 1}`,
    status: index % 2 === 0 ? 'new' : 'in_progress',
    createdBy: { userId: '1', role: 'Manager' },
    siteDetails: {},
    assignmentHistory: [],
    attempt: 0,
    updatedAt: '2026-11-01T00:00:00Z',
    dirty: false,
    syncStatus: 'synced',
  }));
}

function renderDashboard(jobs: Job[], role: 'Manager' | 'TeamLead' = 'Manager') {
  const store = configureStore({
    reducer: { auth: authReducer, jobs: jobsReducer, team: teamReducer, api: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
  store.dispatch(authHydrated({ userId: '1', name: 'User', role, accessToken: 'test-token' }));
  store.dispatch(jobsHydrated(jobs));
  render(
    <Provider store={store}>
      <MemoryRouter><ManagerDashboardPage /></MemoryRouter>
    </Provider>,
  );
  return store;
}

function cardLinks() {
  return screen.getAllByRole('link').filter((link) => link.textContent?.includes('Address'));
}

function nextPage() {
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
}

describe('dashboard pagination', () => {
  it.each(['Manager', 'TeamLead'] as const)('shows twelve cards per page for %s without scroll loading', (role) => {
    renderDashboard(makeJobs(25), role);
    expect(cardLinks()).toHaveLength(12);
    expect(screen.getByText('Showing 1–12 of 25')).toBeTruthy();
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Previous page' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.scroll(window);
    expect(cardLinks()).toHaveLength(12);

    nextPage();
    expect(cardLinks()).toHaveLength(12);
    expect(screen.getByText('Showing 13–24 of 25')).toBeTruthy();
    expect(screen.queryByText('Site 1')).toBeNull();
    expect(screen.getByText('Site 13')).toBeTruthy();

    nextPage();
    expect(cardLinks()).toHaveLength(1);
    expect(screen.getByText('Site 25')).toBeTruthy();
    expect(screen.getByText('Showing 25–25 of 25')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(screen.getByText('Showing 13–24 of 25')).toBeTruthy();
  });

  it('resets the page when search or status changes', () => {
    renderDashboard(makeJobs(25));
    nextPage();
    fireEvent.change(screen.getByPlaceholderText('Search sites or address'), { target: { value: 'Site 2' } });
    expect(screen.getByText('Showing 1–7 of 7')).toBeTruthy();
    expect(screen.getByText('Site 2')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Search sites or address'), { target: { value: '' } });
    nextPage();
    fireEvent.click(screen.getByRole('tab', { name: /Yet to Assign/ }));
    expect(screen.getByText('Showing 1–12 of 13')).toBeTruthy();
    expect(screen.getByText('Site 1')).toBeTruthy();
    expect(within(screen.getByRole('tab', { name: /Yet to Assign/ })).getByText('13')).toBeTruthy();
    nextPage();
    expect(screen.getByText('Showing 13–13 of 13')).toBeTruthy();
  });

  it('clamps the current page when jobs disappear and keeps it valid when they return', () => {
    const jobs = makeJobs(25);
    const store = renderDashboard(jobs);
    nextPage();
    nextPage();
    act(() => { store.dispatch(jobsHydrated(jobs.slice(0, 11))); });
    expect(screen.getByText('Showing 1–11 of 11')).toBeTruthy();
    expect(screen.getByText('Site 11')).toBeTruthy();
    act(() => { store.dispatch(jobsHydrated(jobs)); });
    expect(screen.getByText('Showing 1–12 of 25')).toBeTruthy();
  });

  it('hides pagination when no jobs match', () => {
    renderDashboard(makeJobs(21));
    fireEvent.change(screen.getByPlaceholderText('Search sites or address'), { target: { value: 'no matches' } });
    expect(screen.queryByRole('navigation', { name: 'Job pages' })).toBeNull();
    expect(screen.getByText('No jobs match this filter.')).toBeTruthy();
  });

  it('handles a full single page and approved-only results', () => {
    const jobs = makeJobs(12);
    const store = renderDashboard(jobs);
    expect(cardLinks()).toHaveLength(12);
    expect((screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled).toBe(true);
    act(() => { store.dispatch(jobsHydrated([{ ...jobs[0], status: 'approved' }])); });
    expect(screen.getByText('No jobs match this filter.')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Job pages' })).toBeNull();
  });
});
