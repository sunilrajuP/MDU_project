import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { EXTERNAL_QUESTIONS } from '@/features/survey/runbook/config/externalConfig';
import { openSection, renderRunbook, resetRunbookState, row } from './runbook-helpers';

beforeEach(resetRunbookState);

const card = (label: string) => screen.getByRole('region', { name: label });
const sealing = () => card('External conduit sealing condition noted (egress / vermin risk)');

describe('External Network & Site Entry (seeded, 7/8 as drawn)', () => {
  it('lists all eight questions and matches the drawn status text', async () => {
    renderRunbook();
    await openSection('external');

    expect(EXTERNAL_QUESTIONS).toHaveLength(8);
    for (const question of EXTERNAL_QUESTIONS) expect(card(question.label)).toBeTruthy();

    expect(
      screen.getByText('7/8 items confirmed · External sealing evidence is still required. Section confirmation is disabled.'),
    ).toBeTruthy();
    expect(screen.getAllByText('Captured · Confirmed')).toHaveLength(7);
    expect(within(sealing()).getByText('Incomplete')).toBeTruthy();
    expect(within(sealing()).getByText('Standard · Incomplete')).toBeTruthy();
    expect(screen.getAllByText('Mandatory · Blocks sign-off')).toHaveLength(7);
    expect(screen.getByText('Total confirmed · 22 EUP')).toBeTruthy();
  });

  it('gives every question photo/video capture and a Notes / confirmation box', async () => {
    renderRunbook();
    await openSection('external');
    for (const question of EXTERNAL_QUESTIONS) {
      const item = card(question.label);
      expect(within(item).getByRole('button', { name: `Add photo for ${question.label}` })).toBeTruthy();
      expect(within(item).getByRole('button', { name: `Add video for ${question.label}` })).toBeTruthy();
      expect(within(item).getByLabelText('Notes / confirmation')).toBeTruthy();
    }
  });

  it('shows the extra fields from the design (EUP split, GPS tag, conduit details, measurements, distance)', async () => {
    renderRunbook();
    await openSection('external');
    const eup = card(EXTERNAL_QUESTIONS[1].label);
    expect(within(eup).getByLabelText('Residential (EUP)')).toHaveProperty('value', '20');
    expect(within(eup).getByLabelText('Commercial (EUP)')).toHaveProperty('value', '2');
    expect(within(eup).getByLabelText('Essential services (EUP)')).toHaveProperty('value', '0');
    expect(within(card(EXTERNAL_QUESTIONS[2].label)).getByLabelText('GPS tag')).toBeTruthy();
    const leadIn = card(EXTERNAL_QUESTIONS[3].label);
    for (const label of ['Conduit size', 'Condition', 'Available capacity']) {
      expect(within(leadIn).getByLabelText(label)).toBeTruthy();
    }
    expect(within(card(EXTERNAL_QUESTIONS[4].label)).getByLabelText('Entry point measurements')).toBeTruthy();
    expect(within(card(EXTERNAL_QUESTIONS[6].label)).getByLabelText('Distance')).toHaveProperty('value', '6 m');
  });

  it('validates the unfinished item and blocks Section Complete with the drawn hint', async () => {
    renderRunbook();
    await openSection('external');

    const confirm = within(sealing()).getByRole('button', { name: /Confirm item complete/ });
    expect(confirm).toHaveProperty('disabled', true);
    fireEvent.blur(within(sealing()).getByLabelText('Notes / confirmation'));
    expect(await within(sealing()).findByText('Add sealing notes or a photo to capture this item.')).toBeTruthy();
    expect(within(sealing()).getByText(/Missing: sealing notes or a close-up photo\./)).toBeTruthy();

    expect(screen.getByRole('button', { name: /Section Complete/ })).toHaveProperty('disabled', true);
    expect(screen.getByText('Resolve external conduit sealing condition before marking this section complete.')).toBeTruthy();
  });

  it('confirms the last item with notes alone, then completes the section', async () => {
    renderRunbook();
    await openSection('external');

    fireEvent.change(within(sealing()).getByLabelText('Notes / confirmation'), { target: { value: 'Sealed with mastic.' } });
    const confirm = within(sealing()).getByRole('button', { name: /Confirm item complete/ });
    expect(confirm).toHaveProperty('disabled', false);
    fireEvent.click(confirm);

    expect(screen.getByText('8/8 items confirmed')).toBeTruthy();
    expect(within(row('external')).getByText('Current · 8/8')).toBeTruthy();
    expect(within(sealing()).getByText('Captured · Confirmed')).toBeTruthy();

    const complete = screen.getByRole('button', { name: /Section Complete/ });
    expect(complete).toHaveProperty('disabled', false);
    fireEvent.click(complete);
    expect(within(row('external')).getByText('Completed')).toBeTruthy();
    expect(screen.getByText('3 of 9 steps complete')).toBeTruthy();
  });

  it('reopens a confirmed item and drops the confirmed count', async () => {
    renderRunbook();
    await openSection('external');
    const letterbox = card(EXTERNAL_QUESTIONS[0].label);
    fireEvent.click(within(letterbox).getByRole('button', { name: 'Reopen to update' }));
    expect(screen.getByText(/^6\/8 items confirmed/)).toBeTruthy();
    expect(within(row('external')).getByText('Current · 6/8')).toBeTruthy();
  });

  it('treats an item marked N/A as done', async () => {
    renderRunbook();
    await openSection('external');
    fireEvent.click(within(sealing()).getByRole('button', { name: '— N/A' }));
    expect(screen.getByText('8/8 items confirmed')).toBeTruthy();
    expect(within(sealing()).getByText('N/A')).toBeTruthy();
  });
});

describe('External Network on a blank survey: mandatory notes and evidence', () => {
  it('requires notes and evidence before a mandatory item can be confirmed', async () => {
    renderRunbook('MDU-000004');
    await openSection('external');
    const letterbox = card(EXTERNAL_QUESTIONS[0].label);
    const confirm = within(letterbox).getByRole('button', { name: /Confirm item complete/ });

    expect(within(letterbox).getByText('Required: all panels and unit numbers must be legible in the evidence.')).toBeTruthy();
    fireEvent.blur(within(letterbox).getByLabelText('Notes / confirmation'));
    expect(await within(letterbox).findByText('Add notes confirming this item.')).toBeTruthy();

    // Notes alone are not enough for a mandatory item: evidence is still required.
    fireEvent.change(within(letterbox).getByLabelText('Notes / confirmation'), { target: { value: 'All panels legible.' } });
    expect(confirm).toHaveProperty('disabled', true);
    expect(within(letterbox).getByText(/Missing: photo or video evidence\./)).toBeTruthy();
    expect(within(letterbox).getByText('No evidence attached • Pending capture')).toBeTruthy();
    expect(
      screen.getByText('0/8 items confirmed · Letterbox evidence is still required. Section confirmation is disabled.'),
    ).toBeTruthy();
  });

  it('opens the shared capture flow from a question and keeps entered notes on collapse', async () => {
    renderRunbook('MDU-000004');
    await openSection('external');
    const letterbox = card(EXTERNAL_QUESTIONS[0].label);
    fireEvent.change(within(letterbox).getByLabelText('Notes / confirmation'), { target: { value: 'Typed note' } });

    fireEvent.click(within(letterbox).getByRole('button', { name: `Add photo for ${EXTERNAL_QUESTIONS[0].label}` }));
    expect(await screen.findByRole('dialog', { name: 'Photo Capture' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(row('external')); // collapse
    fireEvent.click(row('external')); // expand
    expect(within(card(EXTERNAL_QUESTIONS[0].label)).getByLabelText('Notes / confirmation')).toHaveProperty('value', 'Typed note');
  });
});
