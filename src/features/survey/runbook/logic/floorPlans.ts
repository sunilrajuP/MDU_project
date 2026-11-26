import { emptyPlan } from '../model/defaults';
import type { FloorDef, FloorPlansData, Issue, PlanState, RunbookModel } from '../model/types';
import { parseNumber } from '../questions/questionLogic';
import { isBlank, makeSummary, type SectionLogic } from './common';

export const planOf = (data: FloorPlansData, code: string): PlanState => data.byFloor[code] ?? emptyPlan();

export const isCalibrated = (plan: PlanState): boolean => {
  const calibration = plan.calibration;
  const distance = parseNumber(calibration?.distanceM);
  return !!calibration?.pointA && !!calibration.pointB && distance !== null && distance > 0;
};

/** Real-world width of the plan image in metres, derived from points A/B and their distance. */
export function planWidthMetres(plan: PlanState): number | null {
  const calibration = plan.calibration;
  if (!isCalibrated(plan) || !calibration?.pointA || !calibration.pointB) return null;
  const dx = calibration.pointB[0] - calibration.pointA[0];
  const dy = (calibration.pointB[1] - calibration.pointA[1]) / calibration.imageAspect;
  const span = Math.hypot(dx, dy);
  const distance = parseNumber(calibration.distanceM);
  return span > 0 && distance ? distance / span : null;
}

/** Plan-ready = captured + calibrated + reviewed, and the surveyor marked the plan complete. */
export const isPlanReady = (plan: PlanState): boolean =>
  plan.ready && plan.media.length > 0 && isCalibrated(plan) && plan.reviewed;

export type PlanStatus = 'not_started' | 'in_progress' | 'ready';
export function planStatus(plan: PlanState): PlanStatus {
  if (isPlanReady(plan)) return 'ready';
  // A pre-filled plan note alone does not make a plan "started" (B1 reads "Not started" with its note in Figma).
  const started = plan.media.length > 0 || isCalibrated(plan) || plan.devices.length > 0;
  return started ? 'in_progress' : 'not_started';
}

export const readyCount = (data: FloorPlansData, floors: FloorDef[]): number =>
  floors.filter((floor) => isPlanReady(planOf(data, floor.code))).length;

function issues(model: RunbookModel): Issue[] {
  const floors = model.data.internal.floors;
  const plans = model.data.floorPlans;
  const found: Issue[] = [];
  const notReady = floors.length - readyCount(plans, floors);
  if (notReady > 0) {
    found.push({
      sectionKey: 'floorPlans',
      title: `${notReady} floor plan${notReady === 1 ? '' : 's'} not ready`,
      detail: 'Upload, calibrate and review all required floor sheets and equipment.',
    });
  }
  if (found.length === 0 && isBlank(plans.siteNotes)) {
    found.push({
      sectionKey: 'floorPlans',
      title: 'Floor plans site surveyor notes',
      detail: 'Add the mandatory site surveyor notes for Floor Plans.',
    });
  }
  return found;
}

export const floorPlansLogic: SectionLogic = {
  key: 'floorPlans',
  issues,
  summarize(model) {
    const floors = model.data.internal.floors;
    const plans = model.data.floorPlans;
    const ready = readyCount(plans, floors);
    const started = floors.some((floor) => planStatus(planOf(plans, floor.code)) !== 'not_started');
    return makeSummary({
      complete: model.completed.floorPlans && issues(model).length === 0,
      started,
      done: ready,
      total: floors.length,
      progress: floors.length === 0 ? 0 : ready / floors.length,
      draftChip: `${ready}/${floors.length} plans ready`,
    });
  },
};
