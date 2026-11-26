import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { surveyorApi } from '@/api/surveyorApi';
import { router } from '@/app/router';
import { authHydrated } from '@/features/auth/authSlice';
import { resetMockDb } from '@/mocks/surveyor/db';
import { store } from '@/store';

function renderAt(path: string) {
  act(() => {
    store.dispatch(authHydrated({ userId: '7', name: 'Alex Morgan', role: 'Surveyor', accessToken: 'token' }));
  });
  const memoryRouter = createMemoryRouter(router.routes, { initialEntries: [path] });
  render(
    <Provider store={store}>
      <RouterProvider router={memoryRouter} />
    </Provider>,
  );
  return memoryRouter;
}

beforeEach(() => {
  resetMockDb();
  act(() => {
    store.dispatch(surveyorApi.util.resetApiState());
  });
});

describe('My Jobs', () => {
  it('lists the assigned jobs with status, sync, progress and the right action per state', async () => {
    renderAt('/survey');

    expect(await screen.findByText('Assigned to Alex Morgan · 4 jobs')).toBeTruthy();
    const block = screen.getByRole('article', { name: 'Block A MDU-000001' });
    expect(within(block).getByText('In Progress')).toBeTruthy();
    expect(within(block).getByText('35% complete · Floor Survey')).toBeTruthy();
    expect(within(block).getByText(/Synced 09:41/)).toBeTruthy();
    expect(within(block).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('35');

    expect(screen.getByRole('button', { name: 'Continue Survey for Block A' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start Survey for Parkside Residences' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rework for Northbank Apartments' })).toBeTruthy();
    expect(screen.getByText('Data retained')).toBeTruthy();
  });

  it('gives every mock job a unique reference', async () => {
    renderAt('/survey');
    await screen.findByText(/Assigned to Alex Morgan/);
    const refs = screen.getAllByText(/^MDU-\d{6}$/).map((node) => node.textContent);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('filters to In Progress', async () => {
    renderAt('/survey');
    await screen.findByText(/Assigned to Alex Morgan · 4 jobs/);
    fireEvent.change(screen.getByLabelText('Filter jobs'), { target: { value: 'in_progress' } });

    expect(screen.getByText('Assigned to Alex Morgan · 2 jobs')).toBeTruthy();
    expect(screen.getByText('10 Smith Apartments')).toBeTruthy();
    expect(screen.queryByText('Parkside Residences')).toBeNull();
  });

  it('shows the returned banner and card in the Returned view', async () => {
    renderAt('/survey');
    await screen.findByText(/Assigned to Alex Morgan/);
    fireEvent.change(screen.getByLabelText('Filter jobs'), { target: { value: 'returned' } });

    expect(screen.getByText('Alex Morgan · 1 returned job')).toBeTruthy();
    expect(screen.getByText('Returned · action required')).toBeTruthy();
    expect(screen.getByText(/Level 3 floor plan needs calibration/)).toBeTruthy();
    expect(screen.getByText('Your submitted evidence is retained.')).toBeTruthy();
  });

  it('shows an empty state when a filter has no jobs', async () => {
    // Parkside is the only not-started job; once started it moves to In Progress.
    await act(async () => {
      await store.dispatch(surveyorApi.endpoints.startSurvey.initiate({ jobRef: 'MDU-000004' }));
    });
    renderAt('/survey');
    await screen.findByText(/Assigned to Alex Morgan/);
    fireEvent.change(screen.getByLabelText('Filter jobs'), { target: { value: 'not_started' } });

    expect(screen.getByText('No jobs match this filter.')).toBeTruthy();
    expect(screen.getByText('Assigned to Alex Morgan · 0 jobs')).toBeTruthy();
  });
});

describe('My Jobs -> Overview -> Runbook flow', () => {
  it('Continue Survey opens the runbook directly', async () => {
    const memoryRouter = renderAt('/survey');
    fireEvent.click(await screen.findByRole('button', { name: 'Continue Survey for Block A' }));
    expect(memoryRouter.state.location.pathname).toBe('/survey/jobs/MDU-000001/runbook');
  });

  it('Rework opens the runbook of a returned job', async () => {
    const memoryRouter = renderAt('/survey');
    fireEvent.click(await screen.findByRole('button', { name: 'Rework for Northbank Apartments' }));
    expect(memoryRouter.state.location.pathname).toBe('/survey/jobs/MDU-000005/runbook');
  });

  it('Start Survey goes to the overview, then Start Survey creates the runbook and navigates to it', async () => {
    const memoryRouter = renderAt('/survey');
    fireEvent.click(await screen.findByRole('button', { name: 'Start Survey for Parkside Residences' }));
    expect(memoryRouter.state.location.pathname).toBe('/survey/jobs/MDU-000004/overview');

    expect(await screen.findByRole('heading', { name: 'Parkside Residences' })).toBeTruthy();
    expect(screen.getByText('MDU-000004 · SCHEDULED 2 OCT 2026')).toBeTruthy();
    expect(screen.getByText('42 Lansdowne Street, East Melbourne VIC 3000')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Start Survey' }));
    await waitFor(() => expect(memoryRouter.state.location.pathname).toBe('/survey/jobs/MDU-000004/runbook'));

    // The job is now in progress, so the overview offers Continue Survey.
    await act(async () => {
      await memoryRouter.navigate('/survey/jobs/MDU-000004/overview');
    });
    expect(await screen.findByRole('button', { name: 'Continue Survey' })).toBeTruthy();
  });

  it('shows Rework on the overview of a returned job', async () => {
    renderAt('/survey/jobs/MDU-000005/overview');
    expect(await screen.findByRole('button', { name: 'Rework' })).toBeTruthy();
  });

  it('shows a not-found message for an unknown job', async () => {
    renderAt('/survey/jobs/NOPE/overview');
    expect(await screen.findByText(/This job could not be found/)).toBeTruthy();
  });
});

describe('Job Overview and Map', () => {
  it('shows the site location card with coordinates and opens the map', async () => {
    const memoryRouter = renderAt('/survey/jobs/MDU-000001/overview');
    expect(await screen.findByText('Site location')).toBeTruthy();
    expect(screen.getByText('−37.81210, 144.97270 · accuracy ±5 m')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Map type' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open Map' }));
    expect(memoryRouter.state.location.pathname).toBe('/survey/jobs/MDU-000001/map');
  });

  it('switches between Terrain and Satellite', async () => {
    renderAt('/survey/jobs/MDU-000001/overview');
    const satellite = await screen.findByRole('button', { name: 'Satellite' });
    expect(screen.getByRole('button', { name: 'Terrain' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(satellite);
    expect(satellite.getAttribute('aria-pressed')).toBe('true');
  });

  it('confirms the site location and returns to the overview showing Confirmed', async () => {
    const memoryRouter = renderAt('/survey/jobs/MDU-000001/map');
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm Site Location' }));

    await waitFor(() => expect(memoryRouter.state.location.pathname).toBe('/survey/jobs/MDU-000001/overview'));
    expect(await screen.findByText('Confirmed')).toBeTruthy();
  });
});

describe('Contacts & Access', () => {
  it('shows the prefilled values with "from manager" tags', async () => {
    renderAt('/survey/jobs/MDU-000001/site-info');
    expect(await screen.findByLabelText(/Contact name/)).toHaveProperty('value', 'Ella Brown');
    expect(screen.getByLabelText(/Stakeholder \/ role/)).toHaveProperty('value', 'Building manager');
    expect(screen.getByLabelText(/Contact phone/)).toHaveProperty('value', '0412 680 144');
    expect(screen.getByLabelText(/Parking available/)).toHaveProperty('value', 'Yes · B1 visitor');
    expect(screen.getByLabelText(/Access window/)).toHaveProperty('value', '09:00–16:00');
    expect(screen.getAllByText(/from manager/)).toHaveLength(4);
  });

  it('validates required fields and email format, and does not navigate while invalid', async () => {
    const memoryRouter = renderAt('/survey/jobs/MDU-000001/site-info');
    fireEvent.change(await screen.findByLabelText(/Contact name/), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/Contact phone/), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText(/Contact email/), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save & Continue survey' }));

    expect(await screen.findByText('Enter the contact name.')).toBeTruthy();
    expect(screen.getByText('Enter a valid phone number.')).toBeTruthy();
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(memoryRouter.state.location.pathname).toBe('/survey/jobs/MDU-000001/site-info');

    // Fixing a field clears its error.
    fireEvent.change(screen.getByLabelText(/Contact name/), { target: { value: 'Ella Brown' } });
    expect(screen.queryByText('Enter the contact name.')).toBeNull();
  });

  it('saves, starts the survey for a not-started job, and continues to the runbook', async () => {
    const memoryRouter = renderAt('/survey/jobs/MDU-000004/site-info');
    fireEvent.change(await screen.findByLabelText(/Access requirements/), { target: { value: 'Bring a torch.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save & Continue survey' }));

    await waitFor(() => expect(memoryRouter.state.location.pathname).toBe('/survey/jobs/MDU-000004/runbook'));

    // The saved value is returned when the form is reopened.
    await act(async () => {
      await memoryRouter.navigate('/survey/jobs/MDU-000004/site-info');
    });
    expect(await screen.findByLabelText(/Access requirements/)).toHaveProperty('value', 'Bring a torch.');
  });
});
