import { useState } from 'react';
import { Callout } from '@/components/ui/Callout';
import { CaptureFlow } from '../../../capture/CaptureFlow';
import { emptyPlan } from '../../model/defaults';
import { floorPlansLogic } from '../../logic/floorPlans';
import { planOf, readyCount } from '../../logic/floorPlans';
import type { Calibration, PlanState } from '../../model/types';
import { useRunbook } from '../../state/runbookContext';
import { SectionFooter } from '../shared/SectionFooter';
import { CalibrationDialog } from './CalibrationDialog';
import { PlanCard } from './PlanCard';
import styles from './FloorPlansSection.module.scss';

interface CalibrateTarget {
  floorCode: string;
  mediaId: string;
  start: 'A' | 'B';
}
interface MarkupTarget {
  floorCode: string;
  mediaId: string;
  label: string;
}

/** Section 5: Floor Plans, Equipment Blocks & Calibration. One plan record per configured floor. */
export function FloorPlansSection() {
  const { jobRef, model, update, setCompleted } = useRunbook();
  const floors = model.data.internal.floors;
  const plans = model.data.floorPlans;
  const [calibrating, setCalibrating] = useState<CalibrateTarget | null>(null);
  const [marking, setMarking] = useState<MarkupTarget | null>(null);

  const ready = readyCount(plans, floors);
  const totalSheets = floors.reduce((sum, floor) => sum + planOf(plans, floor.code).media.length, 0);
  const issues = floorPlansLogic.issues(model);
  const complete = model.completed.floorPlans && issues.length === 0;

  const setPlan = (code: string, plan: PlanState) =>
    update('floorPlans', (current) => ({ ...current, byFloor: { ...current.byFloor, [code]: plan } }));

  return (
    <>
      <Callout tone={ready === floors.length && floors.length > 0 ? 'success' : 'warning'}>
        {ready}/{floors.length} floors plan-ready ·{' '}
        {ready === floors.length
          ? 'Every floor has a captured, calibrated and reviewed plan.'
          : `${totalSheets === 0 ? 'No plans uploaded. ' : ''}Every sheet must be captured, calibrated and reviewed for its floor to be complete.`}
      </Callout>

      <p className={styles.follows}>
        Floor list follows the configured building: {floors.map((floor) => floor.code).join(', ')}. A floor can hold several
        sheets (wings, towers, carpark).
      </p>

      <div className={styles.cards}>
        {floors.map((floor, index) => {
          const plan = plans.byFloor[floor.code] ?? emptyPlan();
          const first = plan.media[0];
          return (
            <PlanCard
              key={floor.code}
              floor={floor}
              plan={plan}
              jobRef={jobRef}
              defaultExpanded={index === 0}
              onChange={(next) => setPlan(floor.code, next)}
              onCalibrate={(start) => first && setCalibrating({ floorCode: floor.code, mediaId: first.id, start })}
              onMarkup={() => first && setMarking({ floorCode: floor.code, mediaId: first.id, label: `${floor.name} floor plan` })}
            />
          );
        })}
      </div>

      <SectionFooter
        notes={plans.siteNotes}
        onNotesChange={(value) => update('floorPlans', (current) => ({ ...current, siteNotes: value }))}
        canComplete={issues.length === 0}
        complete={complete}
        onComplete={() => setCompleted('floorPlans', true)}
        blockedHint={`Upload, calibrate and review every required sheet, route and equipment block for all ${
          floors.length === 6 ? 'six' : floors.length
        } floors before confirming.`}
        completeHint="Floor Plans complete · Saved locally · Pending sync"
      />

      {calibrating && (
        <CalibrationDialog
          mediaId={calibrating.mediaId}
          start={calibrating.start}
          initial={planOf(plans, calibrating.floorCode).calibration}
          onClose={() => setCalibrating(null)}
          onSave={(calibration: Calibration) => {
            const plan = planOf(plans, calibrating.floorCode);
            setPlan(calibrating.floorCode, { ...plan, calibration, ready: false });
            setCalibrating(null);
          }}
        />
      )}

      {marking && (
        <CaptureFlow
          jobRef={jobRef}
          kind="photo"
          itemLabel={marking.label}
          editMediaId={marking.mediaId}
          context={{ sectionKey: 'floorPlans', floorCode: marking.floorCode, itemCode: 'floorPlan', tag: `${marking.floorCode} · floor plan` }}
          onComplete={(attachment) => {
            const plan = planOf(plans, marking.floorCode);
            setPlan(marking.floorCode, {
              ...plan,
              ready: false,
              media: plan.media.map((entry) => (entry.id === attachment.id ? attachment : entry)),
            });
            setMarking(null);
          }}
          onClose={() => setMarking(null)}
        />
      )}
    </>
  );
}
