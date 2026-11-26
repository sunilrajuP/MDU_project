import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { surveyorApi } from '@/api/surveyorApi';
import { router } from '@/app/router';
import { getDb } from '@/data/db/getDb';
import { setSimulatedOffline } from '@/dev/devNetwork';
import { authHydrated } from '@/features/auth/authSlice';
import { resetMockDb } from '@/mocks/surveyor/db';
import { store } from '@/store';

export function renderRunbook(jobRef = 'MDU-000001') {
  act(() => {
    store.dispatch(authHydrated({ userId: '7', name: 'Alex Morgan', role: 'Surveyor', accessToken: 'token' }));
  });
  const memoryRouter = createMemoryRouter(router.routes, { initialEntries: [`/survey/jobs/${jobRef}/runbook`] });
  render(
    <Provider store={store}>
      <RouterProvider router={memoryRouter} />
    </Provider>,
  );
  return memoryRouter;
}

/** The accordion header button of a section (by its stable id, so guide-card buttons never collide). */
export const row = (key: string) => document.getElementById(`runbook-${key}-header`) as HTMLElement;

export async function loaded() {
  await screen.findByText(/steps complete/);
}

export async function openSection(key: string) {
  await loaded();
  if (row(key).getAttribute('aria-expanded') !== 'true') fireEvent.click(row(key));
}

/** Resets every piece of shared state a runbook test touches. */
export async function resetRunbookState() {
  resetMockDb();
  setSimulatedOffline(false);
  await getDb().runbookDrafts.clear();
  await getDb().media.clear();
  act(() => {
    store.dispatch(surveyorApi.util.resetApiState());
  });
}
