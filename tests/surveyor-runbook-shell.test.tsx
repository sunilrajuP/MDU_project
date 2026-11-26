import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/data/db/getDb';
import { surveyorApi } from '@/api/surveyorApi';
import { setSimulatedOffline } from '@/dev/devNetwork';
import { resetMockDb } from '@/mocks/surveyor/db';
import { store } from '@/store';
import { WHS_QUESTIONS } from '@/features/survey/runbook/config/whsConfig';
import { loaded, openSection, renderRunbook, resetRunbookState, row } from './runbook-helpers';

const openWhs = () => openSection('whs');

beforeEach(resetRunbookState);
afterEach(() => setSimulatedOffline(false));

describe('Runbook shell (seeded in-progress job)', () => {
  it('uses its own header with a back arrow and the real connection pill', async () => {
    renderRunbook();
    expect(await screen.findByRole('heading', { level: 1, name: 'Survey Runbook' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to My Jobs' })).toBeTruthy();
    expect(screen.getByText('Online')).toBeTruthy();

    act(() => setSimulatedOffline(true));
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  it('derives progress and every section chip from state', async () => {
    renderRunbook();
    expect(await screen.findByText('MDU-000001 · Block A')).toBeTruthy();
    expect(screen.getByText('2 of 9 steps complete')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Survey progress' }).getAttribute('aria-valuenow')).toBe('22');
    expect(screen.getByRole('button', { name: 'Continue · External Network & Site Entry →' })).toBeTruthy();
    expect(screen.getByText('Your survey steps · 9 steps')).toBeTruthy();

    expect(within(row('whs')).getByText('Completed')).toBeTruthy();
    expect(within(row('bfd')).getByText('Completed')).toBeTruthy();
    expect(within(row('external')).getByText('Current · 7/8')).toBeTruthy();
    expect(within(row('internal')).getByText('Draft · 0/6 floors')).toBeTruthy();
    expect(within(row('floorPlans')).getByText('0/6 plans ready')).toBeTruthy();
    expect(within(row('nbnDesign')).getByText('Draft')).toBeTruthy();
    expect(within(row('bom')).getByText('Unconfirmed')).toBeTruthy();
    expect(within(row('preflight')).getByText('Needs attention')).toBeTruthy();
    expect(within(row('signoff')).getByText('Locked')).toBeTruthy();
  });

  it('shows nine collapsed rows and expands one at a time', async () => {
    renderRunbook();
    await loaded();
    expect(screen.getAllByRole('button', { expanded: false }).filter((el) => el.id.startsWith('runbook-'))).toHaveLength(9);

    fireEvent.click(row('whs'));
    expect(row('whs').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Viewing step 01 · scroll for all steps')).toBeTruthy();

    fireEvent.click(row('external'));
    expect(row('whs').getAttribute('aria-expanded')).toBe('false');
    expect(row('external').getAttribute('aria-expanded')).toBe('true');
  });

  it('Continue opens the current section', async () => {
    renderRunbook();
    fireEvent.click(await screen.findByRole('button', { name: 'Continue →' }));
    expect(row('external').getAttribute('aria-expanded')).toBe('true');
  });
});

describe('WHS Check', () => {
  it('shows the 13 questions as drawn, each with a details box, and flags the 7 hazards', async () => {
    renderRunbook();
    await openWhs();

    expect(WHS_QUESTIONS).toHaveLength(13);
    for (const question of WHS_QUESTIONS) {
      expect(screen.getByRole('radiogroup', { name: question.label })).toBeTruthy();
    }
    expect(screen.getAllByLabelText('Log location / details')).toHaveLength(13);
    expect(screen.getAllByText('Logged and flagged in WHS Notes.')).toHaveLength(7);
    expect(screen.getByText('7 items logged in WHS Notes — consolidated in the CWP report on sign-off.')).toBeTruthy();
    expect(screen.getByText(/WHS check completed .*You can update answers at any time\./)).toBeTruthy();
    expect(screen.getByText(/WHS record complete · /)).toBeTruthy();

    // Yes/No/N/A options exactly where the design has them.
    const ppe = screen.getByRole('radiogroup', { name: WHS_QUESTIONS[0].label });
    expect(within(ppe).getAllByRole('radio').map((el) => el.textContent)).toEqual(['Yes', 'No']);
    const induction = screen.getByRole('radiogroup', { name: WHS_QUESTIONS[1].label });
    expect(within(induction).getAllByRole('radio').map((el) => el.textContent)).toEqual(['Yes', 'No', 'N/A']);
  });

  it('keeps entered data when the section is collapsed and re-expanded', async () => {
    renderRunbook();
    await openWhs();
    const trenching = screen.getByRole('radiogroup', { name: 'Potential for trenching?' });
    fireEvent.click(within(trenching).getByRole('radio', { name: 'N/A' }));
    fireEvent.change(screen.getByLabelText('SURVEYOR NOTES ON SITE HAZARDS'), { target: { value: 'Kept note' } });

    fireEvent.click(row('whs')); // collapse
    expect(screen.queryByText('Potential for trenching?')).toBeNull();
    fireEvent.click(row('whs')); // expand

    const again = screen.getByRole('radiogroup', { name: 'Potential for trenching?' });
    expect(within(again).getByRole('radio', { name: 'N/A' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText('SURVEYOR NOTES ON SITE HAZARDS')).toHaveProperty('value', 'Kept note');
  });

  it('blocks Section Complete until answered, hazards explained and notes entered, then completes', async () => {
    renderRunbook('MDU-000004');
    await openWhs();

    const complete = screen.getByRole('button', { name: /Section Complete/ });
    expect(complete).toHaveProperty('disabled', true);
    expect(screen.getByText(/13 questions unanswered/)).toBeTruthy();

    // Answer everything "Yes" (hazards then need details).
    for (const question of WHS_QUESTIONS) {
      fireEvent.click(within(screen.getByRole('radiogroup', { name: question.label })).getByRole('radio', { name: 'Yes' }));
    }
    expect(complete).toHaveProperty('disabled', true);
    expect(screen.getByText(/7 hazards need details/)).toBeTruthy();

    for (const question of WHS_QUESTIONS.filter((q) => q.hazard)) {
      const input = document.getElementById(`${question.code}-details`) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Controls noted' } });
    }
    expect(complete).toHaveProperty('disabled', true);
    expect(screen.getByText(/site surveyor notes are required/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('SITE SURVEYOR NOTES * (MANDATORY)'), { target: { value: 'Induction done.' } });
    expect(complete).toHaveProperty('disabled', false);

    fireEvent.click(complete);
    expect(within(row('whs')).getByText('Completed')).toBeTruthy();
    expect(screen.getByText('1 of 9 steps complete')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Survey progress' }).getAttribute('aria-valuenow')).toBe('11');
  });

  it('flags a hazard answered Yes without details once the field is visited', async () => {
    renderRunbook('MDU-000004');
    await openWhs();
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Potential for work at heights (>3.5m, stairwells, etc)?' })).getByRole('radio', { name: 'Yes' }));
    const details = document.getElementById('whs.heights-details') as HTMLInputElement;
    fireEvent.blur(details);
    expect(await screen.findByText('Add details for this hazard.')).toBeTruthy();
  });
});

describe('Runbook persistence (offline-first)', () => {
  it('writes edits to Dexie immediately and syncs them to the API when online', async () => {
    renderRunbook('MDU-000004');
    await openWhs();
    fireEvent.change(screen.getByLabelText('SURVEYOR NOTES ON SITE HAZARDS'), { target: { value: 'Draft text' } });

    await waitFor(async () => {
      const draft = await getDb().runbookDrafts.get('MDU-000004:whs');
      expect(draft?.data).toMatchObject({ hazardNotes: 'Draft text' });
    });
    // Synced after the debounce: the draft is clean and the "pending" hint disappears.
    await waitFor(async () => expect((await getDb().runbookDrafts.get('MDU-000004:whs'))?.dirty).toBe(false), { timeout: 4000 });
  });

  it('keeps edits as pending drafts while offline and flushes them on reconnect', async () => {
    renderRunbook('MDU-000004');
    await openWhs();
    act(() => setSimulatedOffline(true));
    fireEvent.change(screen.getByLabelText('SURVEYOR NOTES ON SITE HAZARDS'), { target: { value: 'Offline text' } });

    await waitFor(async () => expect((await getDb().runbookDrafts.get('MDU-000004:whs'))?.dirty).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect((await getDb().runbookDrafts.get('MDU-000004:whs'))?.dirty).toBe(true); // still not synced
    expect(screen.getByText(/Site survey · MDU-000004 · Draft saved locally/)).toBeTruthy();

    act(() => setSimulatedOffline(false));
    await waitFor(async () => expect((await getDb().runbookDrafts.get('MDU-000004:whs'))?.dirty).toBe(false), { timeout: 4000 });
    expect(await screen.findByText(/Site survey · MDU-000004 · All changes synced/)).toBeTruthy();
  });

  it('keeps synced edits across a reload (local draft wins unless the server moved ahead)', async () => {
    renderRunbook('MDU-000004');
    await openWhs();
    fireEvent.change(screen.getByLabelText('SURVEYOR NOTES ON SITE HAZARDS'), { target: { value: 'Survives reload' } });
    await waitFor(async () => expect((await getDb().runbookDrafts.get('MDU-000004:whs'))?.dirty).toBe(false), { timeout: 4000 });
    cleanup();

    // The mock server forgets everything (like a restart) but the device still has its synced copy.
    resetMockDb();
    store.dispatch(surveyorApi.util.resetApiState());
    renderRunbook('MDU-000004');
    await openWhs();
    expect(screen.getByLabelText('SURVEYOR NOTES ON SITE HAZARDS')).toHaveProperty('value', 'Survives reload');
  });

  it('lets a newer server revision win over an older synced local copy', async () => {
    await getDb().runbookDrafts.put({
      id: 'MDU-000001:bfd',
      jobRef: 'MDU-000001',
      key: 'bfd',
      data: { answers: { floorsAboveGround: '99' }, selection: null },
      completed: false,
      baseRev: 0, // older than the seeded server revision (1)
      serverCompleted: false,
      dirty: false,
      updatedAt: new Date().toISOString(),
    });
    renderRunbook();
    await openSection('bfd');
    expect(screen.getByText('RECOMMENDED BFD · FIGURE 4')).toBeTruthy(); // the server's saved selection, not the stale draft
  });

  it('restores an unsynced local draft over the server copy on reload', async () => {
    await getDb().runbookDrafts.put({
      id: 'MDU-000004:whs',
      jobRef: 'MDU-000004',
      key: 'whs',
      data: { answers: {}, hazardNotes: 'From the device', siteNotes: '' },
      completed: false,
      baseRev: 0,
      serverCompleted: false,
      dirty: true,
      updatedAt: new Date().toISOString(),
    });
    renderRunbook('MDU-000004');
    await openWhs();
    expect(screen.getByLabelText('SURVEYOR NOTES ON SITE HAZARDS')).toHaveProperty('value', 'From the device');
  });
});
