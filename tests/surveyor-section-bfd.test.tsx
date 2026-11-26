import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { BFD_STEPS } from '@/features/survey/runbook/config/bfdConfig';
import { openSection, renderRunbook, resetRunbookState, row } from './runbook-helpers';

beforeEach(resetRunbookState);

const next = () => fireEvent.click(screen.getByRole('button', { name: /^(Next|Get recommendation)$/ }));

async function answerAll(values: Record<string, string>) {
  for (const step of BFD_STEPS) {
    const slide = screen.getByText(step.prompt, { selector: 'p' }).parentElement as HTMLElement;
    if (step.type === 'count') {
      fireEvent.change(within(slide).getByLabelText(step.prompt), { target: { value: values[step.code] } });
    } else {
      fireEvent.click(within(slide).getByRole('radio', { name: values[step.code] === 'yes' ? 'Yes' : 'No' }));
    }
    next();
  }
}

describe('BFD Selection Wizard: result as drawn', () => {
  it('shows the recommendation, decision trail and actions for the seeded job', async () => {
    renderRunbook();
    await openSection('bfd');

    expect(screen.getByText('RECOMMENDED BFD · FIGURE 4')).toBeTruthy();
    expect(screen.getByText('BUDI-1S')).toBeTruthy();
    expect(screen.getByText('Medium building fibre device')).toBeTruthy();
    expect(screen.getByText('12F FSL · up to 200 GPON · multiple P2P')).toBeTruthy();
    expect(screen.getByText('BUDI-1S — ≥2 potential business customers (Fig 4)')).toBeTruthy();
    expect(screen.getByText(/Selection saved · .* · 6 of 6 answers recorded\./)).toBeTruthy();

    const trail = screen.getByRole('region', { name: 'Decision trail' });
    const rows = within(trail).getAllByText(/./, { selector: 'dt' }).map((el) => [el.textContent, el.nextElementSibling?.textContent]);
    expect(rows).toEqual([
      ['Floors above ground', '4'],
      ['Basement levels', '1'],
      ['GPON end-user premises', '22'],
      ['Potential business (P2P) locations', '2 · GF shops'],
      ['Fibre TV required', 'No'],
      ['FDT installation likely', 'No'],
    ]);
    expect(
      screen.getByText(/Recommendation follows the supplied Figure 4 example\. Review the six site answers if requirements change; no Fibre TV or FDT is selected\./),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open BFD Selector' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Answers' })).toBeTruthy();
  });
});

describe('BFD Selector carousel', () => {
  it('opens inline inside the section (not a new page) with a step indicator', async () => {
    const memoryRouter = renderRunbook('MDU-000004');
    await openSection('bfd');
    expect(screen.getByText(/No BFD selected yet/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Answers' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open BFD Selector' }));
    const carousel = screen.getByRole('region', { name: 'BFD Selector' });
    expect(row('bfd').getAttribute('aria-expanded')).toBe('true');
    expect(carousel.closest('#runbook-bfd-body')).toBeTruthy(); // inside the BFD section body
    expect(memoryRouter.state.location.pathname).toBe('/survey/jobs/MDU-000004/runbook');
    expect(within(carousel).getByText('Question 1 of 6')).toBeTruthy();
    expect(within(carousel).getByRole('list', { name: 'BFD selector steps' }).children).toHaveLength(7);
    expect(within(carousel).getByRole('button', { name: 'Previous' })).toHaveProperty('disabled', true);
  });

  it('requires an answer on every step and supports previous / next', async () => {
    renderRunbook('MDU-000004');
    await openSection('bfd');
    fireEvent.click(screen.getByRole('button', { name: 'Open BFD Selector' }));

    next();
    expect(await screen.findByText('Enter a number.')).toBeTruthy();
    expect(screen.getByText('Question 1 of 6')).toBeTruthy();

    fireEvent.change(screen.getAllByLabelText('Floors above ground')[0], { target: { value: '4' } });
    next();
    expect(screen.getByText('Question 2 of 6')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('Question 1 of 6')).toBeTruthy();
    expect(screen.getAllByLabelText('Floors above ground')[0]).toHaveProperty('value', '4');
  });

  it('collects six answers, shows the recommendation, saves it and completes the section', async () => {
    renderRunbook('MDU-000004');
    await openSection('bfd');
    fireEvent.click(screen.getByRole('button', { name: 'Open BFD Selector' }));

    await answerAll({
      floorsAboveGround: '4',
      basementLevels: '1',
      gponPremises: '22',
      businessP2p: '2',
      fibreTv: 'no',
      fdtLikely: 'no',
    });

    expect(await screen.findByText('Recommendation')).toBeTruthy();
    expect(screen.getAllByText('BUDI-1S').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Save selection' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'BFD Selector' })).toBeNull());

    expect(within(row('bfd')).getByText('Completed')).toBeTruthy();
    expect(screen.getByText(/6 of 6 answers recorded/)).toBeTruthy();
    expect(screen.getByText('1 of 9 steps complete')).toBeTruthy();
  });

  it('lets a completed selection be re-opened with its answers prefilled', async () => {
    renderRunbook();
    await openSection('bfd');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Answers' }));
    expect(screen.getAllByLabelText('Floors above ground')[0]).toHaveProperty('value', '4');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: 'BFD Selector' })).toBeNull();
  });
});
