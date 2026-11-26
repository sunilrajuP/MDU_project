import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/data/db/getDb';
import { setSimulatedOffline } from '@/dev/devNetwork';
import { MOCK_BOM_ROWS } from '@/mocks/surveyor/bfd';
import { seedCompleteSurvey } from './complete-survey';
import { loaded, openSection, renderRunbook, resetRunbookState, row } from './runbook-helpers';

beforeEach(resetRunbookState);

const card = (label: string) => screen.getByRole('region', { name: label });

describe('Floor Plans (6 floors from the configured building)', () => {
  it('shows the drawn banner, floor list sentence, and six cards with B1 open', async () => {
    renderRunbook();
    await openSection('floorPlans');

    expect(
      screen.getByText('0/6 floors plan-ready · No plans uploaded. Every sheet must be captured, calibrated and reviewed for its floor to be complete.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Floor list follows the configured building: B1, GF, L1, L2, L3, L4. A floor can hold several sheets (wings, towers, carpark).'),
    ).toBeTruthy();

    for (const name of ['Basement 1', 'Ground Floor', 'Level 1', 'Level 2', 'Level 3', 'Level 4']) {
      expect(within(card(name)).getByText('Not started')).toBeTruthy();
      expect(within(card(name)).getByText('No plan captured · 0 sheets · 0 photos')).toBeTruthy();
    }
    // B1 expanded, the others collapsed (as drawn).
    expect(within(card('Basement 1')).getByText('Upload / Capture floor plan')).toBeTruthy();
    expect(within(card('Ground Floor')).queryByText('Upload / Capture floor plan')).toBeNull();
  });

  it('shows calibration, equipment blocks, routes and review controls in their pre-plan state', async () => {
    renderRunbook();
    await openSection('floorPlans');
    const b1 = card('Basement 1');

    expect(within(b1).getByText('Add a clear plan image or PDF · B1')).toBeTruthy();
    expect(within(b1).getByRole('button', { name: '+ Add plan / photo' })).toBeTruthy();
    expect(within(b1).getByText('Pending plan capture · No derived measurements available')).toBeTruthy();
    expect(within(b1).getByRole('button', { name: 'Select point A' })).toHaveProperty('disabled', true);
    expect(within(b1).getByRole('button', { name: 'Select point B' })).toHaveProperty('disabled', true);
    expect(within(b1).getByLabelText('Real-world distance between A and B (m)')).toHaveProperty('placeholder', 'Pending · Upload a plan first');
    expect(within(b1).getByLabelText('Derived scale')).toHaveProperty('value', '— Pending calibration');
    expect(within(b1).getByLabelText('Cable-route length')).toHaveProperty('value', '— Pending calibrated route');
    expect(within(b1).getByText('No plan is present. Scale and route lengths are intentionally unavailable.')).toBeTruthy();

    expect(within(b1).getByText('Place and review devices on a calibrated B1 plan')).toBeTruthy();
    const library = within(b1).getByRole('radiogroup', { name: 'Block library' });
    expect(within(library).getAllByRole('radio').map((el) => el.textContent)).toEqual(['BFD', 'SDT 1:4', 'SDT 1:8', 'ICD', 'Fire Seal', 'Other']);
    expect(within(library).getByRole('radio', { name: 'BFD' }).getAttribute('aria-checked')).toBe('true');
    expect(within(b1).getByRole('button', { name: 'Place equipment block' })).toHaveProperty('disabled', true);
    expect(within(b1).getByLabelText('Device placement completeness')).toHaveProperty('value', '0 devices reviewed · Plan required');

    expect(within(b1).getByRole('button', { name: 'Draw cable route' })).toHaveProperty('disabled', true);
    expect(within(b1).getByRole('button', { name: 'Add measurements / markup' })).toHaveProperty('disabled', true);
    expect(within(b1).getByLabelText('Plan notes')).toHaveProperty('value', 'Capture B1 escape plan; include basement PoC-to-riser pathway.');
    expect(within(within(b1).getByRole('radiogroup', { name: 'Route / equipment / dimension review' })).getByRole('radio', { name: 'Pending' }).getAttribute('aria-checked')).toBe('true');
    expect(within(b1).getByRole('button', { name: 'Mark B1 plan complete' })).toHaveProperty('disabled', true);

    expect(screen.getByText('Upload, calibrate and review every required sheet, route and equipment block for all six floors before confirming.')).toBeTruthy();
  });

  it('follows floors configured in Internal Network (data-driven)', async () => {
    renderRunbook();
    await openSection('internal');
    fireEvent.click(screen.getByRole('button', { name: /Configure floors/ }));
    const dialog = screen.getByRole('dialog', { name: 'Configure floors' });
    fireEvent.change(within(dialog).getByLabelText('Floor code'), { target: { value: 'L5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add floor' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save floors' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(row('floorPlans'));
    expect(screen.getByText(/0\/7 floors plan-ready/)).toBeTruthy();
    expect(screen.getByText(/B1, GF, L1, L2, L3, L4, L5/)).toBeTruthy();
    expect(screen.getByText(/for all 7 floors before confirming/)).toBeTruthy();
  });

  it('derives scale and lets a captured, calibrated and reviewed plan be marked ready', async () => {
    await getDb().runbookDrafts.put({
      id: 'MDU-000004:floorPlans',
      jobRef: 'MDU-000004',
      key: 'floorPlans',
      data: {
        siteNotes: '',
        byFloor: {
          B1: {
            media: [{ id: 'test-plan', kind: 'photo', capturedAt: new Date().toISOString(), hasMarkup: false }],
            calibration: { pointA: [0.1, 0.1], pointB: [0.5, 0.1], distanceM: '10', imageAspect: 1 },
            devices: [],
            notes: '',
            reviewed: true,
            ready: false,
          },
        },
      },
      completed: false,
      baseRev: 0,
      serverCompleted: false,
      dirty: true,
      updatedAt: new Date().toISOString(),
    });
    renderRunbook('MDU-000004');
    await openSection('floorPlans');
    const b1 = card('Basement 1');

    expect(within(b1).getByText('Calibrated · A to B = 10 m')).toBeTruthy();
    expect(within(b1).getByLabelText('Derived scale')).toHaveProperty('value', '1 plan width ≈ 25.0 m');
    expect(within(b1).getByRole('button', { name: 'Place equipment block' })).toHaveProperty('disabled', false);

    fireEvent.click(within(b1).getByRole('button', { name: 'Place equipment block' }));
    expect(within(b1).getByLabelText('Device placement completeness')).toHaveProperty('value', '1 device placed · reviewed');

    fireEvent.click(within(b1).getByRole('button', { name: 'Mark B1 plan complete' }));
    expect(within(b1).getByText('Ready')).toBeTruthy();
    expect(within(row('floorPlans')).getByText('1/6 plans ready')).toBeTruthy();
    expect(screen.getByText(/1\/6 floors plan-ready/)).toBeTruthy();

    // Any edit to a completed plan reopens it.
    fireEvent.change(within(b1).getByLabelText('Plan notes'), { target: { value: 'Edited' } });
    expect(within(b1).queryByText('Ready')).toBeNull();
  });
});

describe('NBN Design Inputs', () => {
  it('shows the BFD card, site details flowed in from other sections, and design inputs as drawn', async () => {
    renderRunbook();
    await openSection('nbnDesign');

    expect(screen.getByText('BFD SELECTED · FIGURE 4 WIZARD')).toBeTruthy();
    expect(screen.getAllByText('BUDI-1S — ≥2 potential business customers (Fig 4)').length).toBeGreaterThan(0);
    expect(screen.getByText(/· Selection saved$/)).toBeTruthy();

    expect(screen.getByLabelText('FLOORS (ABOVE GROUND)')).toHaveProperty('value', '4');
    expect(screen.getByLabelText('BASEMENT LEVELS')).toHaveProperty('value', '1');
    expect(screen.getByLabelText('TOTAL EUP (LETTERBOX)')).toHaveProperty('value', '22'); // from External
    expect(screen.getByLabelText('COMMON AREAS')).toHaveProperty('value', '3');
    expect(screen.getByLabelText('BUSINESS / P2P')).toHaveProperty('value', '2');

    const selected = (group: string) =>
      within(screen.getByRole('radiogroup', { name: group }))
        .getAllByRole('radio')
        .filter((el) => el.getAttribute('aria-checked') === 'true')
        .map((el) => el.textContent);
    expect(selected('FIBRE TV')).toEqual(['No']);
    expect(selected('MDU SOLUTION')).toEqual(['MT-LFN']);
    expect(selected('FDT INSTALLATION REQUIRED')).toEqual(['No']);
    expect(selected('PIT & PIPE AVAILABLE TO EACH EUP')).toEqual(['Yes']);
    expect(selected('CABLING SOLUTION PER FLOOR')).toEqual(['PIC direct']);

    expect(screen.getByText('EUP 22 · P2P 2 · Floors 4 + 1 basement · Fibre TV No · Solution MT-LFN')).toBeTruthy();
    expect(screen.getByText('Selected design input: PIC direct. Confirm the pathway for each configured floor against the survey records.')).toBeTruthy();
    expect(screen.getByText('No plans uploaded · 6 configured floors require plan evidence.')).toBeTruthy();
    expect(screen.getByText('Add surveyor notes and relevant plans before confirming NBN Design Inputs.')).toBeTruthy();
  });

  it('requires design notes, and lets typed values override the flowed-in ones', async () => {
    renderRunbook();
    await openSection('nbnDesign');

    fireEvent.blur(screen.getByLabelText('SURVEYOR NOTES *'));
    expect(await screen.findByText('Required: add design input notes before completing this section.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Section Complete/ })).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByLabelText('FLOORS (ABOVE GROUND)'), { target: { value: '5' } });
    expect(screen.getByLabelText('FLOORS (ABOVE GROUND)')).toHaveProperty('value', '5');
    expect(screen.getByText(/Floors 5 \+ 1 basement/)).toBeTruthy();
  });

  it('links to the BFD wizard and the floor plans', async () => {
    renderRunbook();
    await openSection('nbnDesign');
    fireEvent.click(screen.getByRole('button', { name: 'Review Floor Plans · Step 05' }));
    expect(row('floorPlans').getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(row('nbnDesign'));
    fireEvent.click(screen.getByRole('button', { name: 'Review wizard' }));
    expect(row('bfd').getAttribute('aria-expanded')).toBe('true');
  });
});

describe('BoM Review & Confirm', () => {
  it('lists the 15 rows as drawn with source tags, flags and the fittings warning', async () => {
    renderRunbook();
    await openSection('bom');

    expect(screen.getByText(/The BoM derives from floor-plan equipment blocks/)).toBeTruthy();
    expect(
      screen.getByText('Draft reference estimate · Not reconciled to this survey. Plans are still missing; all 15 rows remain unconfirmed. Quantities are not a live calculation.'),
    ).toBeTruthy();
    expect(MOCK_BOM_ROWS).toHaveLength(15);

    const list = screen.getByRole('list', { name: 'Bill of materials' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(15);
    const find = (name: string) => items.find((li) => within(li).queryByText(name)) as HTMLElement;
    expect(find('NTD').textContent).toContain('22');
    expect(within(find('NTD')).getByText('CALCULATED')).toBeTruthy();
    expect(within(find('1F SDS cable')).getByText('MANUAL')).toBeTruthy();
    expect(within(find('BUDI-1S')).getByText('PLAN')).toBeTruthy();
    expect(within(find('Conduit fittings (bends / joins)')).getByText('Missing fittings · Review required')).toBeTruthy();
    expect(
      screen.getByText('Conduit fittings are 0 ea. Enter an estimate or explicitly confirm none are required. Review against the completed plans before sign-off.'),
    ).toBeTruthy();
    expect(screen.getByText(/0\/15 rows confirmed/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm reviewed BoM' })).toHaveProperty('disabled', true);
  });

  it('confirms rows, completes the BoM, and any later change resets the confirmation', async () => {
    renderRunbook();
    await openSection('bom');
    for (const bom of MOCK_BOM_ROWS) fireEvent.click(screen.getByRole('checkbox', { name: `Confirm ${bom.item}` }));

    expect(screen.getByText(/15\/15 rows confirmed/)).toBeTruthy();
    const confirm = screen.getByRole('button', { name: 'Confirm reviewed BoM' });
    expect(confirm).toHaveProperty('disabled', false);
    fireEvent.click(confirm);
    expect(within(row('bom')).getByText('Completed')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit quantity for Cable tray' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Quantity for Cable tray' }), { target: { value: '14' } });
    expect(within(row('bom')).queryByText('Completed')).toBeNull();
    const tray = within(screen.getByRole('list', { name: 'Bill of materials' })).getAllByRole('listitem').find((li) => within(li).queryByText('Cable tray'));
    expect(within(tray as HTMLElement).getByRole('textbox', { name: 'Quantity for Cable tray' })).toHaveProperty('value', '14');
    expect(screen.getByRole('checkbox', { name: 'Confirm Cable tray' })).toHaveProperty('checked', false);
  });

  it('clears the fittings flag once an estimate is entered', async () => {
    renderRunbook();
    await openSection('bom');
    fireEvent.click(screen.getByRole('button', { name: 'Edit quantity for Conduit fittings (bends / joins)' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Quantity for Conduit fittings (bends / joins)' }), { target: { value: '4' } });
    expect(screen.queryByText('Missing fittings · Review required')).toBeNull();
    expect(screen.queryByText(/Conduit fittings are 0 ea/)).toBeNull();
  });
});

describe('Pre-flight Validation (derived)', () => {
  it('lists every outstanding group from state, as drawn', async () => {
    renderRunbook();
    await openSection('preflight');

    expect(screen.getByText('Outstanding mandatory checks · Survey cannot be submitted until all required evidence and confirmations pass.')).toBeTruthy();
    expect(screen.getByText('22% complete')).toBeTruthy();
    expect(screen.getByText('2 of 9 survey steps complete. WHS and BFD selection are complete; validation has not passed.')).toBeTruthy();
    expect(screen.getByText('7 outstanding groups')).toBeTruthy();

    const list = screen.getByRole('list', { name: 'Outstanding items' });
    const cards = within(list).getAllByRole('button').map((el) => el.textContent ?? '');
    expect(cards).toHaveLength(7);
    expect(cards[0]).toContain('03 · External Network & Site Entry');
    expect(cards[0]).toContain('External conduit sealing condition');
    expect(cards[0]).toContain('Add sealing notes or a close-up photo, then confirm the item.');
    expect(cards[1]).toContain('Shared building record · 3 fields missing');
    expect(cards[1]).toContain('Record available capacity, incoming FSL count and total vertical riser distance.');
    expect(cards[2]).toContain('B1 floor, basement and unit evidence');
    expect(cards[2]).toContain('2 independent unit records');
    expect(cards[3]).toContain('GF, L1, L2, L3 and L4 checks');
    expect(cards[3]).toContain('Survey and confirm all remaining configured floors.');
    expect(cards[4]).toContain('05 · Floor Plans');
    expect(cards[4]).toContain('6 floor plans not ready');
    expect(cards[5]).toContain('06 · NBN Design Inputs');
    expect(cards[5]).toContain('Mandatory surveyor notes and plans');
    expect(cards[6]).toContain('07 · BoM Review & Confirm');
    expect(cards[6]).toContain('15 rows unconfirmed · fittings missing');

    expect(screen.getByRole('button', { name: 'Submit survey' })).toHaveProperty('disabled', true);
    expect(screen.getByText('Submission remains disabled while mandatory checks are outstanding. Offline pending sync does not mean submitted.')).toBeTruthy();
  });

  it('opens the owning section from a card and from Fix Outstanding Items', async () => {
    renderRunbook();
    await openSection('preflight');
    fireEvent.click(within(screen.getByRole('list', { name: 'Outstanding items' })).getAllByRole('button')[6]);
    expect(row('bom').getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(row('preflight'));
    fireEvent.click(screen.getByRole('button', { name: 'Fix Outstanding Items' }));
    expect(row('external').getAttribute('aria-expanded')).toBe('true');
  });

  it('updates live as the survey changes', async () => {
    renderRunbook();
    await openSection('external');
    fireEvent.change(
      within(card('External conduit sealing condition noted (egress / vermin risk)')).getByLabelText('Notes / confirmation'),
      { target: { value: 'Sealed.' } },
    );
    fireEvent.click(within(card('External conduit sealing condition noted (egress / vermin risk)')).getByRole('button', { name: /Confirm item complete/ }));
    fireEvent.click(screen.getByRole('button', { name: /Section Complete/ }));

    fireEvent.click(row('preflight'));
    expect(screen.getByText('6 outstanding groups')).toBeTruthy();
    expect(screen.getByText(/WHS, BFD selection and External Network & Site Entry are complete/)).toBeTruthy();
  });
});

describe('Sign-off & Submit', () => {
  it('is locked while pre-flight has outstanding checks', async () => {
    renderRunbook();
    await openSection('signoff');

    expect(screen.getByText(/Sign-off locked · Pre-flight validation has outstanding mandatory checks/)).toBeTruthy();
    expect(screen.getByText('Draft · Not submitted')).toBeTruthy();
    expect(screen.getByLabelText('Surveyor name')).toHaveProperty('value', 'Alex Morgan');
    expect(screen.getByLabelText('Survey date')).toHaveProperty('readOnly', true);
    expect(screen.getByLabelText('Review time')).toHaveProperty('value', expect.stringContaining('Local device time'));
    expect(screen.getByRole('checkbox')).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Sign off & Submit' })).toHaveProperty('disabled', true);
    expect(screen.getByText(/The survey becomes read-only only after successful submission/)).toBeTruthy();
    expect(screen.getByText(/Current record: draft saved locally · 0 changes pending sync · No submission receipt|Current record: all changes synced/)).toBeTruthy();
  });

  it('unlocks when the whole survey is valid, requires the declaration, then submits and goes read-only', async () => {
    await seedCompleteSurvey('MDU-000004');
    renderRunbook('MDU-000004');
    await loaded();

    // Seven sections confirmed + Pre-flight (derived, no issues) = 8; only sign-off remains.
    expect(screen.getByText('8 of 9 steps complete')).toBeTruthy();
    await openSection('preflight');
    expect(screen.getByText('All mandatory checks pass. The survey is ready for sign-off.')).toBeTruthy();
    expect(within(row('preflight')).getByText('Ready')).toBeTruthy();

    fireEvent.click(row('signoff'));
    expect(screen.queryByText(/Sign-off locked/)).toBeNull();
    const submit = screen.getByRole('button', { name: 'Sign off & Submit' });
    expect(submit).toHaveProperty('disabled', true); // declaration still required

    fireEvent.click(screen.getByRole('checkbox'));
    expect(submit).toHaveProperty('disabled', false);
    fireEvent.click(submit);

    expect(await screen.findByText('Survey submitted. It is now read-only.')).toBeTruthy();
    expect(within(row('signoff')).getByText('Submitted')).toBeTruthy();
    expect(screen.getByText('9 of 9 steps complete')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Survey progress' }).getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByRole('checkbox')).toHaveProperty('disabled', true);

    // Read-only: controls inside the other sections are disabled.
    fireEvent.click(row('whs'));
    // A disabled <fieldset> disables its controls without setting their own `disabled` property.
    expect(screen.getByLabelText('SITE SURVEYOR NOTES * (MANDATORY)').matches(':disabled')).toBe(true);
  });

  it('queues a sign-off made offline, does not call it submitted, and submits on reconnect', async () => {
    await seedCompleteSurvey('MDU-000004');
    renderRunbook('MDU-000004');
    await openSection('signoff');
    fireEvent.click(screen.getByRole('checkbox'));

    act(() => setSimulatedOffline(true));
    fireEvent.click(screen.getByRole('button', { name: 'Sign off & queue submission' }));

    expect(await screen.findByText(/Signed off on this device\. The survey will be submitted when you are back online\. It is not submitted yet\./)).toBeTruthy();
    expect(screen.queryByText('Survey submitted. It is now read-only.')).toBeNull();
    expect(within(row('signoff')).getByText('Submission pending sync')).toBeTruthy();
    expect(screen.queryByText('9 of 9 steps complete')).toBeNull();

    act(() => setSimulatedOffline(false));
    expect(await screen.findByText('Survey submitted. It is now read-only.', undefined, { timeout: 4000 })).toBeTruthy();
    expect(within(row('signoff')).getByText('Submitted')).toBeTruthy();
  });
});
