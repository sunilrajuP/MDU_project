import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/api/baseApi';
import { surveyorApi } from '@/api/surveyorApi';
import { db } from '@/data/db/schema';
import { authRepo } from '@/data/repos/authRepo';
import { backendSurveyRepo } from '@/data/repos/backendSurveyRepo';
import { jobsRepo } from '@/data/repos/jobsRepo';
import authReducer, { authHydrated } from '@/features/auth/authSlice';
import { BackendRunbookPage } from '@/features/survey/runbook/BackendRunbookPage';
import type { BackendSurvey } from '@/types/backendSurvey';
import type { Job } from '@/types/domain';

const session = { userId: '7', name: 'Surveyor', role: 'Surveyor' as const, accessToken: 'test-token' };
const job: Job = {
  id: '6', jobRef: 'MDU-000006', siteName: 'Test Site', address: 'Test address',
  status: 'in_progress', createdBy: { userId: '7', role: 'Surveyor' },
  siteDetails: { notes: '', buildingType: 'Apartment', numUnits: 1 },
  assignmentHistory: [], attempt: 0, updatedAt: '2026-01-01T00:00:00Z',
  dirty: false, syncStatus: 'synced',
};

function survey(): BackendSurvey {
  return {
    jobId: 6, jobRef: 'MDU-000006', sessionId: 'session-1', status: 'InProgress',
    sections: [
      {
        id: 1, code: 'WHS', title: 'WHS Check', sortOrder: 1, repeatPerFloor: false, isCompleted: false,
        items: [
          { id: 11, sectionId: 1, code: 'PPE', prompt: 'PPE confirmed?', answerType: 'YES_NO_NA',
            isRequired: true, minPhotos: 0, flagOn: null, sortOrder: 1, responseValue: null,
            isAnswered: false, isFlagged: false, note: null },
          { id: 12, sectionId: 1, code: 'PHOTO', prompt: 'Site photo', answerType: 'PHOTO',
            isRequired: true, minPhotos: 1, flagOn: null, sortOrder: 2, responseValue: null,
            isAnswered: false, isFlagged: false, note: null },
        ],
      },
      {
        id: 4, code: 'INTERNAL_NETWORK', title: 'Internal Network', sortOrder: 2,
        repeatPerFloor: true, isCompleted: false,
        items: [{ id: 41, sectionId: 4, code: 'FLOOR', prompt: 'Floor entry', answerType: 'TEXT',
          isRequired: true, minPhotos: 0, flagOn: null, sortOrder: 1, responseValue: null,
          isAnswered: false, isFlagged: false, note: null }],
      },
    ],
  };
}

function makeStore() {
  const store = configureStore({
    reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer, [surveyorApi.reducerPath]: surveyorApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware, surveyorApi.middleware),
  });
  store.dispatch(authHydrated(session));
  return store;
}

function renderPage(store: ReturnType<typeof makeStore>) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/survey/jobs/MDU-000006/runbook']}>
        <Routes><Route path="/survey/jobs/:jobRef/runbook" element={<BackendRunbookPage />} /></Routes>
      </MemoryRouter>
    </Provider>,
  );
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await authRepo.set(session);
  await jobsRepo.upsert(job);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('backend survey runbook', () => {
  it('loads by numeric job ID and sends selected answers to the real section endpoint', async () => {
    const data = survey();
    const requests: { url: string; method: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ url, method: init?.method ?? 'GET', body });
      if (init?.method === 'PUT') {
        const answer = body.answers[0];
        Object.assign(data.sections[0].items[0], {
          responseValue: answer.value, isFlagged: answer.isFlagged, note: answer.note, isAnswered: true,
        });
      }
      return Response.json(data);
    }));
    const store = makeStore();
    renderPage(store);
    fireEvent.click(await screen.findByRole('button', { name: /WHS Check/, expanded: false }));
    expect(screen.getByText('Site photo: photo upload is not available yet.')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'PPE confirmed?' })).getByRole('radio', { name: 'Yes' }));
    await waitFor(() => expect(requests.some((request) => request.method === 'PUT')).toBe(true), { timeout: 5000 });
    expect(requests[0]).toMatchObject({ url: '/api/jobs/6/survey', method: 'GET' });
    expect(requests.find((request) => request.method === 'PUT')).toEqual({
      url: '/api/jobs/6/survey-sessions/session-1/sections/1/answers',
      method: 'PUT',
      body: { answers: [{ itemId: 11, value: 'true', isFlagged: false, note: '' }] },
    });
    await waitFor(async () => expect(Object.keys((await backendSurveyRepo.get('7', 'MDU-000006'))!.pending)).toHaveLength(0));
    fireEvent.click(screen.getByRole('button', { name: /Internal Network/ }));
    expect(screen.getByRole('textbox', { name: /^Floor entry/ }).matches(':disabled')).toBe(true);
  });

  it('retains failed answers across reload and uses cached questions offline', async () => {
    let offline = false;
    let failSave = true;
    const data = survey();
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => !offline);
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (offline || (init?.method === 'PUT' && failSave)) throw new TypeError('Network unavailable');
      if (init?.method === 'PUT') {
        const answer = JSON.parse(String(init.body)).answers[0];
        Object.assign(data.sections[0].items[0], {
          responseValue: answer.value, isFlagged: answer.isFlagged, note: answer.note, isAnswered: true,
        });
      }
      return Response.json(data);
    }));
    const store = makeStore();
    const page = renderPage(store);
    fireEvent.click(await screen.findByRole('button', { name: /WHS Check/, expanded: false }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'PPE confirmed?' })).getByRole('radio', { name: 'No' }));
    await screen.findByText(/Answers remain saved locally but could not sync/, {}, { timeout: 5000 });
    page.unmount();
    offline = true;
    store.dispatch(surveyorApi.util.resetApiState());
    renderPage(store);
    fireEvent.click(await screen.findByRole('button', { name: /WHS Check/, expanded: false }));
    expect(within(screen.getByRole('radiogroup', { name: 'PPE confirmed?' })).getByRole('radio', { name: 'No' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/Offline: answers are saved/)).toBeTruthy();
    expect((await backendSurveyRepo.get('7', 'MDU-000006'))?.pending['1:11'].value).toBe('false');
    failSave = false;
    offline = false;
    fireEvent(window, new Event('online'));
    await waitFor(async () => expect(Object.keys((await backendSurveyRepo.get('7', 'MDU-000006'))!.pending)).toHaveLength(0), { timeout: 5000 });
  });

  it('does not acknowledge answers if the server response does not confirm them', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(survey())));
    const store = makeStore();
    renderPage(store);
    fireEvent.click(await screen.findByRole('button', { name: /WHS Check/, expanded: false }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'PPE confirmed?' })).getByRole('radio', { name: 'N/A' }));
    expect(await screen.findByText(/The server did not confirm the saved answers/, {}, { timeout: 5000 })).toBeTruthy();
    expect((await backendSurveyRepo.get('7', 'MDU-000006'))?.pending['1:11'].value).toBe('N/A');
  });

  it('retains local answers if the server returns a different session', async () => {
    const data = survey();
    await backendSurveyRepo.receive('7', 'MDU-000006', data);
    await backendSurveyRepo.edit('7', 'MDU-000006', 1, { itemId: 11, value: 'true', isFlagged: false, note: '' });
    await expect(backendSurveyRepo.receive('7', 'MDU-000006', { ...data, sessionId: 'other' })).rejects.toThrow('session changed');
    expect((await backendSurveyRepo.get('7', 'MDU-000006'))?.pending['1:11'].value).toBe('true');
  });

  it('does not clear a newer local edit when an older save is acknowledged', async () => {
    const data = survey();
    const older = { itemId: 11, value: 'true', isFlagged: false, note: '' };
    await backendSurveyRepo.receive('7', 'MDU-000006', data);
    await backendSurveyRepo.edit('7', 'MDU-000006', 1, older);
    await backendSurveyRepo.edit('7', 'MDU-000006', 1, { ...older, value: 'false' });
    await backendSurveyRepo.acknowledge('7', 'MDU-000006', data, 1, [older]);
    expect((await backendSurveyRepo.get('7', 'MDU-000006'))?.pending['1:11'].value).toBe('false');
  });

  it('does not sync local answers after the server marks the survey submitted', async () => {
    const data = survey();
    await backendSurveyRepo.receive('7', 'MDU-000006', data);
    await backendSurveyRepo.edit('7', 'MDU-000006', 1, { itemId: 11, value: 'true', isFlagged: false, note: '' });
    const fetchMock = vi.fn(async () => Response.json({ ...data, status: 'Submitted' }));
    vi.stubGlobal('fetch', fetchMock);
    renderPage(makeStore());
    expect(await screen.findByText(/Pending local answers remain on this device/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await backendSurveyRepo.get('7', 'MDU-000006'))?.pending['1:11'].value).toBe('true');
  });
});
