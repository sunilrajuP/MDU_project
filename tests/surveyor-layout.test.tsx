import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { router } from '@/app/router';
import { setSimulatedOffline } from '@/dev/devNetwork';
import { authHydrated } from '@/features/auth/authSlice';
import { store } from '@/store';
import type { Role } from '@/types/domain';

function renderAt(path: string, role: Role = 'Surveyor') {
  act(() => {
    store.dispatch(authHydrated({ userId: '7', name: 'Alex Morgan', role, accessToken: 'token' }));
  });
  const memoryRouter = createMemoryRouter(router.routes, { initialEntries: [path] });
  render(
    <Provider store={store}>
      <RouterProvider router={memoryRouter} />
    </Provider>,
  );
  return memoryRouter;
}

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

beforeEach(() => setSimulatedOffline(false));
afterEach(() => setSimulatedOffline(false));

describe('Surveyor layout and routes', () => {
  it('shows My Jobs at /survey with My Jobs and Account navigation', () => {
    renderAt('/survey');
    expect(heading()).toBe('My Jobs');
    expect(screen.getAllByRole('link', { name: 'My Jobs' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Account' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Survey Runbook' })).toBeNull();
  });

  it.each([
    ['/survey/jobs/MDU-000001/overview', 'Job Overview'],
    ['/survey/jobs/MDU-000001/map', 'Map'],
    ['/survey/jobs/MDU-000001/site-info', 'Contacts & Access'],
    ['/survey/jobs/MDU-000001/runbook', 'Survey Runbook'],
    ['/survey/account', 'Account'],
  ])('resolves %s with the "%s" title', (path, title) => {
    renderAt(path);
    expect(heading()).toBe(title);
  });

  it('adds the Survey Runbook tab inside a job and shows the job in the breadcrumb', async () => {
    renderAt('/survey/jobs/MDU-000001/overview');
    expect(screen.getAllByRole('link', { name: 'Survey Runbook' }).length).toBeGreaterThan(0);
    expect(await screen.findByText('My Jobs / MDU-000001 · Block A')).toBeTruthy();
  });

  it('redirects unknown survey paths to My Jobs', () => {
    const memoryRouter = renderAt('/survey/nope');
    expect(memoryRouter.state.location.pathname).toBe('/survey');
  });

  it('keeps Manager users out of the Surveyor area', () => {
    const memoryRouter = renderAt('/survey', 'Manager');
    expect(memoryRouter.state.location.pathname).toBe('/dashboard');
  });
});

describe('dev-only network toggle', () => {
  it('simulates offline and online, and the connection pill follows it', () => {
    renderAt('/survey');
    const toggle = screen.getByRole('switch', { name: 'Network' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Online')).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(navigator.onLine).toBe(false);
    expect(screen.getByText('Offline')).toBeTruthy();

    fireEvent.click(toggle);
    expect(navigator.onLine).toBe(true);
    expect(screen.getByText('Online')).toBeTruthy();
  });
});
