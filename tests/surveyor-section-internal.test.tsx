import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BASEMENT_ITEMS,
  BUILDING_ITEMS,
  DEFAULT_FLOORS,
  FLOOR_ITEMS,
  UNIT_ITEMS,
} from '@/features/survey/runbook/config/internalConfig';
import { EXTERNAL_QUESTIONS } from '@/features/survey/runbook/config/externalConfig';
import { seedSections } from '@/mocks/surveyor/seedRunbook';
import { openSection, renderRunbook, resetRunbookState } from './runbook-helpers';

beforeEach(resetRunbookState);

// Every item from docs/internal-network-items.md, by its drawn label. Nothing may be missing.
const EXPECTED_UNIT = [
  'Unit identifier · Linked floor',
  'Representative entry photo',
  'Proposed NTD location',
  'GPO proximity distance + photo',
  'Existing ICD / NTD at entry if present',
  'Door-entry pathway',
  'SDT-to-ICD/NTD distance (m)',
  'ICD required · 20 m threshold',
];
const EXPECTED_FLOOR = [
  'Fire escape plan · photo · two-point calibration',
  'General floor / corridor photo',
  'All relevant riser locations · individual evidence',
  'Riser dimensions · height × width',
  'Conduit / tray type · size · available capacity · photo',
  'Fire rating · fire-rated / non-rated / unknown',
  'Penetration · fire penetration sealing · photo',
  'Access security · locked / unlocked / restricted · photo',
  'SDT mounting location · photo',
  'Mounting surface suitability · prohibited-location check',
  'Horizontal pathway type',
  'Clear Track exclusion check',
  'Pathway switchboard clearance ≥1000 mm',
  'Measured annotated conduit / tray runs (no zero-length)',
  'Route · equipment blocks · dimension annotations reviewed',
  'Corridor dimensions · width AND height · photo',
  'Tray condition · capacity AND damage (distinct)',
  'Fire-rated wall penetration identification · photo',
];
const EXPECTED_BASEMENT = [
  'Basement access · photo',
  'PoC / BFD location confirmation',
  'PoC-to-riser pathway · distinct photo + measured distance',
  'Confined-space risk · controls log',
  'Plant / meter room locations · NBN equipment exclusion zones',
];
const EXPECTED_BUILDING = [
  'Building Entry Point (BEP) to Internal Equipment',
  'PoC / BFD location + photo',
  'BFD type',
  'Height from floor reference (400–1800 mm)',
  'Switchboard clearance ≥1000 mm',
  'Pipe clearance ≥150 mm',
  'Gas clearance ≥500 mm',
  'Prohibited-location check',
  'NBN label confirmed or absence recorded with photo',
  'Available port / fibre capacity',
  'Incoming FSL cable count',
  'Total riser vertical distance basement-to-top (m)',
];

describe('Internal Network config completeness', () => {
  it('contains every extracted item (8 unit, 18 floor, 5 basement, 12 building)', () => {
    expect(UNIT_ITEMS.map((d) => d.label)).toEqual(EXPECTED_UNIT);
    expect(FLOOR_ITEMS.map((d) => d.label)).toEqual(EXPECTED_FLOOR);
    expect(BASEMENT_ITEMS.map((d) => d.label)).toEqual(EXPECTED_BASEMENT);
    expect(BUILDING_ITEMS.map((d) => d.label)).toEqual(EXPECTED_BUILDING);
  });

  it('uses unique item codes, and the default building has the six drawn floors', () => {
    const codes = [...UNIT_ITEMS, ...FLOOR_ITEMS, ...BASEMENT_ITEMS, ...BUILDING_ITEMS].map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(DEFAULT_FLOORS.map((f) => f.code)).toEqual(['B1', 'GF', 'L1', 'L2', 'L3', 'L4']);
    expect(DEFAULT_FLOORS.filter((f) => f.kind === 'basement').map((f) => f.code)).toEqual(['B1']);
  });

  it('keeps every seeded code valid against the config', () => {
    const sections = seedSections('MDU-000001');
    const find = (key: string) => sections.find((s) => s.key === key)?.data as Record<string, unknown>;
    const externalCodes = new Set(EXTERNAL_QUESTIONS.map((q) => q.code));
    const externalItems = find('external').items as Record<string, unknown>;
    for (const code of Object.keys(externalItems)) expect(externalCodes.has(code)).toBe(true);

    const internal = find('internal') as {
      building: Record<string, unknown>;
      byFloor: { B1: { checklist: Record<string, unknown>; basement: Record<string, unknown>; units: { items: Record<string, unknown> }[] } };
    };
    const building = new Set(BUILDING_ITEMS.map((d) => d.code));
    for (const code of Object.keys(internal.building)) expect(building.has(code)).toBe(true);
    const floor = internal.byFloor.B1;
    const floorCodes = new Set(FLOOR_ITEMS.map((d) => d.code));
    const basementCodes = new Set(BASEMENT_ITEMS.map((d) => d.code));
    const unitCodes = new Set(UNIT_ITEMS.map((d) => d.code));
    for (const code of Object.keys(floor.checklist)) expect(floorCodes.has(code)).toBe(true);
    for (const code of Object.keys(floor.basement)) expect(basementCodes.has(code)).toBe(true);
    for (const unit of floor.units) for (const code of Object.keys(unit.items)) expect(unitCodes.has(code)).toBe(true);
  });
});

const tab = (code: string) => screen.getByRole('tab', { name: new RegExp(`^${code}`) });
const unit = (label: string) => screen.getByRole('region', { name: `Unit ${label}` });

describe('Internal Network as drawn (seeded B1)', () => {
  it('shows the floor strip with per-floor counts from data', async () => {
    renderRunbook();
    await openSection('internal');

    const tabs = screen.getAllByRole('tab').map((el) => el.textContent);
    expect(tabs).toEqual(['B10/23', 'GF0/18', 'L10/18', 'L20/18', 'L30/18', 'L40/18']);
    expect(tab('B1').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: /Configure floors/ })).toBeTruthy();
    expect(screen.getByText('B1 · 2 units')).toBeTruthy();
    expect(screen.getByText('0/2 units complete')).toBeTruthy();
    expect(screen.getByText(/Building 9\/12 records · B1 floor 0\/18 checks \+ 0\/5 basement checks · Unit B1-01 2\/8 checks\. No floor is complete\./)).toBeTruthy();
  });

  it('shows the units with their derived progress and the independence warning', async () => {
    renderRunbook();
    await openSection('internal');

    expect(within(unit('B1-01')).getByText('Draft · 2/8')).toBeTruthy();
    expect(within(unit('B1-01')).getByText('B1 · Draft saved locally · 2/8 checks complete')).toBeTruthy();
    expect(
      within(unit('B1-01')).getByText(
        'Unit evidence is independent. Missing: entry photo, NTD location, GPO photo, door-entry pathway, SDT-to-NTD distance and ICD decision.',
      ),
    ).toBeTruthy();
    expect(within(unit('B1-02')).getByText('Draft · 1/8')).toBeTruthy();
    // First unit open, second collapsed (as drawn).
    expect(within(unit('B1-01')).getAllByRole('region').length).toBe(8);
    expect(within(unit('B1-02')).queryAllByRole('region')).toHaveLength(0);
  });

  it('renders all 8 unit questions, 18 floor checks (numbered), 5 basement checks and 12 building records', async () => {
    renderRunbook();
    await openSection('internal');

    for (const label of EXPECTED_UNIT) expect(within(unit('B1-01')).getByRole('region', { name: label })).toBeTruthy();

    const floorGroup = screen.getByRole('region', { name: 'B1 · Floor-level checklist' });
    for (const label of EXPECTED_FLOOR) expect(within(floorGroup).getByRole('region', { name: label })).toBeTruthy();
    expect(within(floorGroup).getByText('0/18 standard checks confirmed · All below-floor evidence remains draft')).toBeTruthy();

    const basementGroup = screen.getByRole('region', { name: 'B1-only · Basement checks' });
    for (const label of EXPECTED_BASEMENT) expect(within(basementGroup).getByRole('region', { name: label })).toBeTruthy();
    expect(within(basementGroup).getByText('Additional checks for basement floors only · 0/5 confirmed · Not applicable for GF–L4')).toBeTruthy();
    expect(within(basementGroup).getByText('0/5')).toBeTruthy();

    const buildingGroup = screen.getByRole('region', { name: 'Building-level shared PoC / BFD' });
    for (const label of EXPECTED_BUILDING) expect(within(buildingGroup).getByRole('region', { name: label })).toBeTruthy();
    expect(within(buildingGroup).getByText('Capture once for this building · 9/12 records complete · 3 pending')).toBeTruthy();
    expect(within(buildingGroup).getByText(/Shared record BFD-01 · Located on B1\./)).toBeTruthy();
    expect(within(buildingGroup).getByRole('button', { name: 'Confirm shared building record' })).toHaveProperty('disabled', true);
  });

  it('blocks Section Complete and requires the mandatory notes', async () => {
    renderRunbook();
    await openSection('internal');
    expect(screen.getByRole('button', { name: /Section Complete/ })).toHaveProperty('disabled', true);
    expect(
      screen.getByText('Complete building records, each floor checklist and each required unit record independently before confirming Internal Network.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('SITE SURVEYOR NOTES * (MANDATORY)')).toBeTruthy();
  });

  it('validates a required unit field with the drawn message and live GPO limit hint', async () => {
    renderRunbook();
    await openSection('internal');
    const b101 = unit('B1-01');

    expect(within(b101).getByText('2.4 m is within the 3 m limit.')).toBeTruthy();
    fireEvent.change(within(b101).getByLabelText('GPO proximity distance (m)'), { target: { value: '4' } });
    expect(within(b101).getByText('4 m exceeds the 3 m limit.')).toBeTruthy();

    fireEvent.blur(within(b101).getByRole('textbox', { name: 'SDT-to-ICD/NTD distance (m)' }));
    expect(
      await within(b101).findByText('Enter the measured distance for B1-01. No value has been copied from another unit.'),
    ).toBeTruthy();
  });

  it('switches floor: no basement group above ground, and the building record stays shared', async () => {
    renderRunbook();
    await openSection('internal');
    fireEvent.click(tab('GF'));

    expect(tab('GF').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('GF · 0 units')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'GF · Floor-level checklist' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: /Basement checks/ })).toBeNull();
    expect(screen.getAllByRole('region', { name: 'Building-level shared PoC / BFD' })).toHaveLength(1);
    expect(screen.getByText(/Shared record BFD-01 · Located on B1\./)).toBeTruthy();
  });
});

describe('Units: add, independent answers, remove with confirmation', () => {
  async function onGroundFloor() {
    renderRunbook();
    await openSection('internal');
    fireEvent.click(tab('GF'));
  }

  it('adds units with the full question set and sequential stable labels', async () => {
    await onGroundFloor();
    fireEvent.click(screen.getByRole('button', { name: '+ Add Unit' }));
    expect(screen.getByText('GF · 1 unit')).toBeTruthy();
    expect(within(unit('GF-01')).getAllByRole('region')).toHaveLength(8);
    expect(within(unit('GF-01')).getByText('Draft · 1/8')).toBeTruthy(); // identifier is auto-captured
    // The auto-filled identifier card starts collapsed (as drawn); expand to read it. It has no "Reopen".
    fireEvent.click(within(unit('GF-01')).getByRole('button', { name: 'Expand Unit identifier · Linked floor' }));
    expect(within(unit('GF-01')).getByRole('textbox', { name: 'Unit identifier · Linked floor' })).toHaveProperty('value', 'GF-01 · Linked MDU-000001/GF');
    expect(within(unit('GF-01')).queryByRole('button', { name: 'Reopen to update' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '+ Add Unit' }));
    expect(screen.getByText('GF · 2 units')).toBeTruthy();
    expect(unit('GF-02')).toBeTruthy();
  });

  it('stores each unit\'s answers independently', async () => {
    await onGroundFloor();
    fireEvent.click(screen.getByRole('button', { name: '+ Add Unit' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add Unit' }));

    const ntd = (label: string) => within(unit(label)).getByRole('textbox', { name: 'Proposed NTD location' });
    fireEvent.change(ntd('GF-01'), { target: { value: 'Hallway cupboard' } });
    expect(ntd('GF-01')).toHaveProperty('value', 'Hallway cupboard');
    expect(ntd('GF-02')).toHaveProperty('value', '');
  });

  it('asks for confirmation before removing, keeps data on cancel, and never reuses a unit number', async () => {
    await onGroundFloor();
    fireEvent.click(screen.getByRole('button', { name: '+ Add Unit' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add Unit' }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove unit GF-01' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove unit GF-01?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('GF · 2 units')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove unit GF-01' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Remove unit GF-01?' })).getByRole('button', { name: 'Remove unit' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Unit GF-01' })).toBeNull());
    expect(screen.getByText('GF · 1 unit')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '+ Add Unit' }));
    expect(unit('GF-03')).toBeTruthy(); // GF-01 and GF-02 are never reissued
    expect(screen.queryByRole('region', { name: 'Unit GF-01' })).toBeNull();
  });

  it('keeps "Mark unit complete" disabled until every question is confirmed', async () => {
    await onGroundFloor();
    fireEvent.click(screen.getByRole('button', { name: '+ Add Unit' }));
    const gf01 = unit('GF-01');
    expect(within(gf01).getByRole('button', { name: 'Mark unit complete' })).toHaveProperty('disabled', true);
    expect(within(gf01).getByText('Completing this unit does not complete the floor or building record.')).toBeTruthy();
  });
});

describe('Configure floors', () => {
  const dialog = () => screen.getByRole('dialog', { name: 'Configure floors' });

  async function openDialog() {
    renderRunbook();
    await openSection('internal');
    fireEvent.click(screen.getByRole('button', { name: /Configure floors/ }));
  }

  it('adds a floor (data-driven tabs and counts update)', async () => {
    await openDialog();
    fireEvent.change(within(dialog()).getByLabelText('Floor code'), { target: { value: 'l5' } });
    fireEvent.change(within(dialog()).getByLabelText('Floor name'), { target: { value: 'Level 5' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add floor' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save floors' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getAllByRole('tab')).toHaveLength(7);
    expect(tab('L5').textContent).toBe('L50/18');
  });

  it('identifies basement floors by type: a new basement floor gets the 5 basement checks', async () => {
    await openDialog();
    fireEvent.change(within(dialog()).getByLabelText('Floor code'), { target: { value: 'B2' } });
    fireEvent.change(within(dialog()).getByLabelText('Floor type'), { target: { value: 'basement' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add floor' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save floors' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(tab('B2').textContent).toBe('B20/23');
    fireEvent.click(tab('B2'));
    expect(screen.getByRole('region', { name: 'B2-only · Basement checks' })).toBeTruthy();
  });

  it('rejects duplicate and malformed codes', async () => {
    await openDialog();
    fireEvent.change(within(dialog()).getByLabelText('Floor code'), { target: { value: 'GF' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add floor' }));
    expect(await within(dialog()).findByText('A floor with code GF already exists.')).toBeTruthy();

    fireEvent.change(within(dialog()).getByLabelText('Floor code'), { target: { value: 'not valid!' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add floor' }));
    expect(await within(dialog()).findByText(/Enter a short floor code/)).toBeTruthy();
  });

  it('removes an empty floor directly, but confirms removal of a floor with data and archives it', async () => {
    await openDialog();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Remove floor L4' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save floors' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('tab', { name: /^L4/ })).toBeNull();

    // B1 holds data: confirm first.
    fireEvent.click(screen.getByRole('button', { name: /Configure floors/ }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Remove floor B1' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save floors' }));
    const confirm = await screen.findByRole('dialog', { name: 'Remove floors with data?' });
    expect(within(confirm).getByText(/B1 has entered data\. It is archived, not deleted/)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Remove floors' }));
    await waitFor(() => expect(screen.queryByRole('tab', { name: /^B1/ })).toBeNull());

    // Adding B1 back restores its archived units and answers.
    fireEvent.click(screen.getByRole('button', { name: /Configure floors/ }));
    fireEvent.change(within(dialog()).getByLabelText('Floor code'), { target: { value: 'B1' } });
    fireEvent.change(within(dialog()).getByLabelText('Floor type'), { target: { value: 'basement' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add floor' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save floors' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(tab('B1'));
    expect(screen.getByText('B1 · 2 units')).toBeTruthy();
  });

  it('cannot remove the last floor', async () => {
    await openDialog();
    for (const code of ['B1', 'GF', 'L1', 'L2', 'L3']) {
      fireEvent.click(within(dialog()).getByRole('button', { name: `Remove floor ${code}` }));
    }
    expect(within(dialog()).getByRole('button', { name: 'Remove floor L4' })).toHaveProperty('disabled', true);
  });
});
