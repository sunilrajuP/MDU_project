import {
  BASEMENT_CHECK_TOTAL,
  BASEMENT_ITEMS,
  BUILDING_ITEMS,
  BUILDING_TOTAL,
  FLOOR_CHECK_TOTAL,
  FLOOR_ITEMS,
  UNIT_ITEMS,
} from '../config/internalConfig';
import { emptyFloor } from '../model/defaults';
import type { FloorDef, FloorState, InternalData, Issue, ItemState, RunbookModel, UnitState } from '../model/types';
import { countDone, isItemDone } from '../questions/questionLogic';
import { isBlank, joinList, makeSummary, type SectionLogic } from './common';

export const floorStateOf = (data: InternalData, code: string): FloorState => data.byFloor[code] ?? emptyFloor();

export const isBasement = (floor: FloorDef) => floor.kind === 'basement';

/** Checks that count toward a floor tab: 18 floor checks (+5 basement checks on basement floors). */
export const floorTotal = (floor: FloorDef) => FLOOR_CHECK_TOTAL + (isBasement(floor) ? BASEMENT_CHECK_TOTAL : 0);

export function floorDone(floor: FloorDef, state: FloorState): number {
  return countDone(FLOOR_ITEMS, state.checklist) + (isBasement(floor) ? countDone(BASEMENT_ITEMS, state.basement) : 0);
}

export const unitDone = (unit: UnitState): number => countDone(UNIT_ITEMS, unit.items);
export const isUnitComplete = (unit: UnitState): boolean => unit.completed && unitDone(unit) === UNIT_ITEMS.length;

export function buildingDone(data: InternalData): number {
  return countDone(BUILDING_ITEMS, data.building);
}

/** A floor is complete when its checks are confirmed and it has at least one fully completed unit, all units complete. */
export function isFloorComplete(floor: FloorDef, state: FloorState): boolean {
  return (
    floorDone(floor, state) === floorTotal(floor) &&
    state.units.length > 0 &&
    state.units.every(isUnitComplete)
  );
}

export const floorHasProgress = (floor: FloorDef, state: FloorState): boolean =>
  floorDone(floor, state) > 0 || state.units.some((unit) => unitDone(unit) > 1 || unit.completed);

/** Unit label for a floor: B1-01, B1-02 ... (sequence never reused after a removal). */
export const unitLabel = (floorCode: string, sequence: number): string => `${floorCode}-${String(sequence).padStart(2, '0')}`;

/** Unit questions that are required and not yet confirmed, as a readable list for the warning banner. */
export function unitMissingNames(unit: UnitState): string[] {
  return UNIT_ITEMS.filter((def) => def.required && !isItemDone(unit.items[def.code])).map((def) => def.shortName ?? def.label);
}

export function missingBuildingNames(building: Record<string, ItemState>): string[] {
  return BUILDING_ITEMS.filter((def) => !isItemDone(building[def.code])).map((def) => def.shortName ?? def.label);
}

function issues(model: RunbookModel): Issue[] {
  const data = model.data.internal;
  const found: Issue[] = [];

  const missingBuilding = missingBuildingNames(data.building);
  if (missingBuilding.length > 0 || !data.buildingConfirmed) {
    const count = missingBuilding.length;
    found.push({
      sectionKey: 'internal',
      title: count > 0 ? `Shared building record · ${count} field${count === 1 ? '' : 's'} missing` : 'Shared building record not confirmed',
      detail: count > 0 ? `Record ${joinList(missingBuilding)}.` : 'Confirm the shared building record.',
    });
  }

  const untouched: string[] = [];
  for (const floor of data.floors) {
    const state = floorStateOf(data, floor.code);
    if (isFloorComplete(floor, state)) continue;
    if (!floorHasProgress(floor, state)) {
      untouched.push(floor.code);
      continue;
    }
    const floorRemaining = FLOOR_CHECK_TOTAL - countDone(FLOOR_ITEMS, state.checklist);
    const basementRemaining = isBasement(floor) ? BASEMENT_CHECK_TOTAL - countDone(BASEMENT_ITEMS, state.basement) : 0;
    const parts = [`${floorRemaining} floor checks`];
    if (isBasement(floor)) parts.push(`${basementRemaining} basement checks`);
    const units = state.units.length;
    parts.push(units > 0 ? `the ${units === 1 ? 'one' : units} independent unit record${units === 1 ? '' : 's'}` : 'at least one unit record');
    found.push({
      sectionKey: 'internal',
      title: `${floor.code} floor${isBasement(floor) ? ', basement' : ''} and unit evidence`,
      detail: `Complete ${joinList(parts)}.`,
    });
  }
  if (untouched.length > 0) {
    found.push({
      sectionKey: 'internal',
      title: `${joinList(untouched)} checks`,
      detail: 'Survey and confirm all remaining configured floors.',
    });
  }

  if (found.length === 0 && isBlank(data.siteNotes)) {
    found.push({
      sectionKey: 'internal',
      title: 'Internal Network site surveyor notes',
      detail: 'Add the mandatory site surveyor notes for Internal Network.',
    });
  }
  return found;
}

export const internalLogic: SectionLogic = {
  key: 'internal',
  issues,
  summarize(model) {
    const data = model.data.internal;
    const floors = data.floors;
    const floorsComplete = floors.filter((floor) => isFloorComplete(floor, floorStateOf(data, floor.code))).length;

    const grandTotal = BUILDING_TOTAL + floors.reduce((sum, floor) => sum + floorTotal(floor), 0);
    const grandDone =
      buildingDone(data) + floors.reduce((sum, floor) => sum + floorDone(floor, floorStateOf(data, floor.code)), 0);

    return makeSummary({
      complete: model.completed.internal && issues(model).length === 0,
      started: grandDone > 0 || !isBlank(data.siteNotes),
      done: floorsComplete,
      total: floors.length,
      progress: grandTotal === 0 ? 0 : grandDone / grandTotal,
      draftChip: `Draft · ${floorsComplete}/${floors.length} floors`,
    });
  },
};
