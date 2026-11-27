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
import { SurveyorJobCard } from '@/features/survey/jobs/SurveyorJobCard';
import { BackendRunbookPage } from '@/features/survey/runbook/BackendRunbookPage';
import type { BackendSurvey, SurveyCardAnswers } from '@/types/backendSurvey';
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

function acceptCards(data: BackendSurvey, cards: SurveyCardAnswers[]) {
  for (const card of cards) {
    const section = data.sections.find((entry) => entry.id === card.sectionId)!;
    for (const answer of card.answers) {
      const item = section.items.find((entry) => entry.id === answer.itemId)!;
      Object.assign(item, {
        responseValue: answer.value || null, isFlagged: answer.isFlagged, note: answer.note, isAnswered: !!answer.value,
      });
    }
  }
}

function makeStore() {
  const store = configureStore({
    reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer, [surveyorApi.reducerPath]: surveyorApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware, surveyorApi.middleware),
  });
  store.dispatch(authHydrated(session));
  return store;
}

function renderPage(store: ReturnType<typeof makeStore>, startSurvey = false, strict = false) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[{ pathname: '/survey/jobs/MDU-000006/runbook', state: { startSurvey } }]}>
        <Routes><Route path="/survey/jobs/:jobRef/runbook" element={<BackendRunbookPage />} /></Routes>
      </MemoryRouter>
    </Provider>,
    { reactStrictMode: strict },
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
  it('starts a session when continuing a survey from its job card', async () => {
    const fetchMock = vi.fn(async () => Response.json(survey()));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <Provider store={makeStore()}>
        <MemoryRouter initialEntries={['/survey']}>
          <Routes>
            <Route path="/survey" element={<SurveyorJobCard job={{
              jobRef: job.jobRef!, siteName: job.siteName, address: job.address, status: 'in_progress',
              scheduledDate: '2026-01-01', progress: null, sync: { state: 'synced', lastSyncedAt: job.updatedAt }, returned: null,
            }} />} />
            <Route path="/survey/jobs/:jobRef/runbook" element={<BackendRunbookPage />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue Survey for Test Site' }));
    expect(await screen.findByRole('button', { name: /WHS Check/, expanded: false })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/jobs/6/survey-start', expect.objectContaining({ method: 'POST', body: '6' }));
  });

  it('starts or resumes the survey before loading the runbook', async () => {
    const requests: { url: string; method: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({
        url, method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return Response.json(survey());
    }));
    renderPage(makeStore(), true);
    expect(await screen.findByRole('button', { name: /WHS Check/, expanded: false })).toBeTruthy();
    expect(requests.slice(0, 2)).toEqual([
      { url: '/api/jobs/6/survey-start', method: 'POST', body: 6 },
      { url: '/api/jobs/6/survey', method: 'GET', body: undefined },
    ]);
  });

  it('shows the start error and does not load the survey if starting fails', async () => {
    const fetchMock = vi.fn(async () => Response.json({ message: 'Cannot start survey' }, { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    renderPage(makeStore(), true);
    expect(await screen.findByText(/Cannot start survey/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('opens the cached survey offline without starting a session', async () => {
    await backendSurveyRepo.receive('7', 'MDU-000006', survey());
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fetchMock = vi.fn(async () => { throw new TypeError('Network unavailable'); });
    vi.stubGlobal('fetch', fetchMock);
    renderPage(makeStore(), true);
    expect(await screen.findByRole('button', { name: /WHS Check/, expanded: false })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/jobs/6/survey', expect.objectContaining({ method: 'GET' }));
  });

  it('loads and saves a survey whose backend session ID is numeric', async () => {
    const data = survey();
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        requests.push(url);
        acceptCards(data, JSON.parse(String(init.body)));
      }
      return Response.json({ ...data, sessionId: 6 });
    }));
    renderPage(makeStore());
    fireEvent.click(await screen.findByRole('button', { name: /WHS Check/, expanded: false }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'PPE confirmed?' })).getByRole('radio', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(async () => {
      expect(requests).toContain('/api/jobs/6/survey-sessions/6/sections/1/answers');
      const saved = await backendSurveyRepo.get('7', 'MDU-000006');
      expect(saved?.survey.sessionId).toBe('6');
      expect(Object.keys(saved!.pending)).toHaveLength(0);
    });
    expect(screen.queryByText(/could not sync/)).toBeNull();
  });

  it('retains pending answers when a save returns a different numeric session ID', async () => {
    const data = survey();
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') acceptCards(data, JSON.parse(String(init.body)));
      return Response.json({ ...data, sessionId: init?.method === 'PUT' ? 7 : 6 });
    }));
    renderPage(makeStore());
    fireEvent.click(await screen.findByRole('button', { name: /WHS Check/, expanded: false }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'PPE confirmed?' })).getByRole('radio', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText(/invalid or different survey after saving/)).toBeTruthy();
    expect((await backendSurveyRepo.get('7', 'MDU-000006'))?.pending['1:11']?.value).toBe('true');
  });

  it('loads by numeric job ID and sends selected answers to the real section endpoint', async () => {
    const data = survey();
    data.sections[0].items.push({
      id: 13, sectionId: 1, code: 'SITE_NAME', prompt: 'Site name', answerType: 'TEXT',
      isRequired: false, minPhotos: 0, flagOn: null, sortOrder: 3, responseValue: null,
      isAnswered: false, isFlagged: false, note: null,
    });
    const requests: { url: string; method: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ url, method: init?.method ?? 'GET', body });
      if (init?.method === 'PUT') {
        acceptCards(data, body);
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
      body: [{ sectionId: 1, answers: [
        { itemId: 11, value: 'true', isFlagged: false, note: '' },
        { itemId: 13, value: '', isFlagged: false, note: '' },
      ] }],
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
        acceptCards(data, JSON.parse(String(init.body)));
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

  it('sends only the target section when moving to the next card', async () => {
    const data = survey();
    data.sections[1].repeatPerFloor = false;
    data.sections.push({ id: 9, code: 'SIGN_OFF', title: 'Sign off', sortOrder: 3, repeatPerFloor: false, isCompleted: false, items: [] });
    const requests: { url: string; body: SurveyCardAnswers[] }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as SurveyCardAnswers[];
        requests.push({ url, body });
        acceptCards(data, body);
      }
      return Response.json(data);
    }));
    renderPage(makeStore());
    fireEvent.click(await screen.findByRole('button', { name: /WHS Check/, expanded: false }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'PPE confirmed?' })).getByRole('radio', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: /WHS Check/, expanded: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Internal Network/, expanded: true })).toBeTruthy();
    await waitFor(() => expect(requests).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false));
    fireEvent.change(screen.getByRole('textbox', { name: /^Floor entry/ }), { target: { value: 'Level 1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: /Internal Network/, expanded: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Sign off/, expanded: true })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]).toEqual({
      url: '/api/jobs/6/survey-sessions/session-1/sections/4/answers',
      body: [{ sectionId: 4, answers: [{ itemId: 41, value: 'Level 1', isFlagged: false, note: '' }] }],
    });
  });

  it('moves to the next card offline and retains its answers for retry', async () => {
    let offline = false;
    const data = survey();
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => !offline);
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (offline) throw new TypeError('Network unavailable');
      if (init?.method === 'PUT') acceptCards(data, JSON.parse(String(init.body)));
      return Response.json(data);
    }));
    renderPage(makeStore());
    fireEvent.click(await screen.findByRole('button', { name: /WHS Check/, expanded: false }));
    offline = true;
    fireEvent(window, new Event('offline'));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'PPE confirmed?' })).getByRole('radio', { name: 'No' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: /Internal Network/, expanded: true })).toBeTruthy();
    await waitFor(async () => expect((await backendSurveyRepo.get('7', 'MDU-000006'))?.pending['1:11']?.value).toBe('false'));
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

  it('opens the current session and discards unsynced answers from an older session', async () => {
    const data = survey();
    await backendSurveyRepo.receive('7', 'MDU-000006', data);
    await backendSurveyRepo.edit('7', 'MDU-000006', 1, { itemId: 11, value: 'true', isFlagged: false, note: '' });
    const fetchMock = vi.fn(async () => Response.json({ ...data, sessionId: 'other' }));
    vi.stubGlobal('fetch', fetchMock);
    renderPage(makeStore(), false, true);
    fireEvent.click(await screen.findByRole('button', { name: /WHS Check/, expanded: false }));
    expect(screen.getByText(/Unsynced answers from an earlier survey session were discarded/)).toBeTruthy();
    expect(within(screen.getByRole('radiogroup', { name: 'PPE confirmed?' })).getByRole('radio', { name: 'Yes' }).getAttribute('aria-checked')).toBe('false');
    expect(await backendSurveyRepo.get('7', 'MDU-000006')).toMatchObject({ survey: { sessionId: 'other' }, pending: {} });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retains pending answers when the server session has not changed', async () => {
    const data = survey();
    const answer = { itemId: 11, value: 'true', isFlagged: false, note: '' };
    await backendSurveyRepo.receive('7', 'MDU-000006', data);
    await backendSurveyRepo.edit('7', 'MDU-000006', 1, answer);
    await backendSurveyRepo.receive('7', 'MDU-000006', data);
    expect((await backendSurveyRepo.get('7', 'MDU-000006'))?.pending['1:11']).toEqual(answer);
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
