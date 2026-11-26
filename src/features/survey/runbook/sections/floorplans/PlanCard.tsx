import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/ChoiceGroup';
import { Input } from '@/components/ui/Input';
import { StatusChip } from '@/components/ui/StatusChip';
import { EvidenceCapture } from '../../../capture/EvidenceCapture';
import { isCalibrated, isPlanReady, planStatus, planWidthMetres } from '../../logic/floorPlans';
import type { Calibration, FloorDef, PlanState } from '../../model/types';
import styles from './PlanCard.module.scss';

/** Equipment block library (as drawn). */
const BLOCKS = ['BFD', 'SDT 1:4', 'SDT 1:8', 'ICD', 'Fire Seal', 'Other'];

const STATUS_LABEL = { not_started: 'Not started', in_progress: 'In progress', ready: 'Ready' } as const;
const STATUS_TONE = { not_started: 'neutral', in_progress: 'brand', ready: 'success' } as const;

interface PlanCardProps {
  floor: FloorDef;
  plan: PlanState;
  jobRef: string;
  defaultExpanded: boolean;
  onChange: (plan: PlanState) => void;
  /** Open the calibration dialog for this floor's first sheet, starting at point A or B. */
  onCalibrate: (point: 'A' | 'B') => void;
  /** Open the markup editor on the first sheet (draw cable routes / add measurements). */
  onMarkup: () => void;
}

/** One floor's plan record: sheets, two-point calibration, equipment blocks, cable routes/markup and review. */
export function PlanCard({ floor, plan, jobRef, defaultExpanded, onChange, onCalibrate, onMarkup }: Readonly<PlanCardProps>) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [block, setBlock] = useState(BLOCKS[0]);

  const status = planStatus(plan);
  const hasPlan = plan.media.length > 0;
  const calibrated = isCalibrated(plan);
  const ready = isPlanReady(plan);
  const width = planWidthMetres(plan);
  const sheets = plan.media.length;

  const calibration: Calibration = plan.calibration ?? { pointA: null, pointB: null, distanceM: '', imageAspect: 1 };

  let calibrationNote = 'Pending plan capture · No derived measurements available';
  if (hasPlan) {
    calibrationNote = calibrated
      ? `Calibrated · A to B = ${calibration.distanceM} m`
      : 'Plan captured · Select points A and B, then enter their real-world distance';
  }

  let deviceText = '0 devices reviewed · Plan required';
  if (hasPlan) {
    const placed = `${plan.devices.length} device${plan.devices.length === 1 ? '' : 's'} placed`;
    deviceText = calibrated ? `${placed} · ${plan.reviewed ? 'reviewed' : 'review pending'}` : `${placed} · Calibrate the plan first`;
  }

  const patch = (change: Partial<PlanState>) => {
    // Any change to a plan that was marked complete reopens it.
    onChange({ ...plan, ...change, ready: change.ready ?? false });
  };

  return (
    <section className={[styles.card, expanded ? styles.open : ''].filter(Boolean).join(' ')} aria-label={floor.name}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${floor.name}`}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className={styles.titles}>
          <span className={styles.name}>{floor.name}</span>
          <span className={styles.sub}>
            {hasPlan ? 'Plan captured' : 'No plan captured'} · {sheets} sheet{sheets === 1 ? '' : 's'} · {sheets} photo{sheets === 1 ? '' : 's'}
          </span>
        </span>
        <StatusChip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusChip>
        {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>

      {expanded && (
        <div className={styles.body}>
          <EvidenceCapture
            variant="plan"
            planLabel={floor.code}
            jobRef={jobRef}
            context={{ sectionKey: 'floorPlans', floorCode: floor.code, itemCode: 'floorPlan', tag: `${floor.code} · floor plan` }}
            itemLabel={`${floor.name} floor plan`}
            allowVideo={false}
            value={plan.media}
            onChange={(media) => patch({ media })}
          />

          <section className={styles.panel} aria-label="Two-point calibration">
            <h4 className={styles.panelTitle}>Two-point calibration</h4>
            <p className={styles.note}>{calibrationNote}</p>
            <Button type="button" variant="secondary" disabled={!hasPlan} onClick={() => onCalibrate('A')}>
              Select point A
            </Button>
            <Button type="button" variant="secondary" disabled={!hasPlan} onClick={() => onCalibrate('B')}>
              Select point B
            </Button>
            <Input
              label="Real-world distance between A and B (m)"
              inputMode="decimal"
              disabled={!hasPlan}
              placeholder="Pending · Upload a plan first"
              value={calibration.distanceM}
              onChange={(event) => patch({ calibration: { ...calibration, distanceM: event.target.value } })}
            />
            <Input label="Derived scale" readOnly value={width ? `1 plan width ≈ ${width.toFixed(1)} m` : '— Pending calibration'} />
            <Input label="Cable-route length" readOnly value="— Pending calibrated route" />
            <p className={styles.hint}>
              {hasPlan
                ? 'Scale is derived from points A and B. Cable-route length is not measured yet.'
                : 'No plan is present. Scale and route lengths are intentionally unavailable.'}
            </p>
          </section>

          <section className={styles.panel} aria-label="Equipment blocks">
            <h4 className={styles.panelTitle}>Equipment blocks</h4>
            <p className={styles.note}>Place and review devices on a calibrated {floor.code} plan</p>
            <div className={styles.field}>
              <span className={styles.label}>Block library</span>
              <ChoiceGroup label="Block library" options={BLOCKS.map((value) => ({ value, label: value }))} value={block} onChange={setBlock} />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={!calibrated}
              onClick={() => patch({ devices: [...plan.devices, { id: crypto.randomUUID(), type: block }] })}
            >
              Place equipment block
            </Button>
            <Input label="Device placement completeness" readOnly value={deviceText} />
            {plan.devices.length > 0 && (
              <ul className={styles.devices} aria-label="Placed devices">
                {plan.devices.map((device) => (
                  <li key={device.id}>
                    <span>{device.type}</span>
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={`Remove ${device.type} block`}
                      onClick={() => patch({ devices: plan.devices.filter((entry) => entry.id !== device.id) })}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.panel} aria-label="Cable routes, markups and notes">
            <h4 className={styles.panelTitle}>Cable routes, markups and notes</h4>
            <Button type="button" variant="secondary" disabled={!hasPlan} onClick={onMarkup}>
              Draw cable route
            </Button>
            <Button type="button" variant="secondary" disabled={!hasPlan} onClick={onMarkup}>
              Add measurements / markup
            </Button>
            <Input label="Plan notes" value={plan.notes} placeholder="Not recorded" onChange={(event) => patch({ notes: event.target.value })} />
            <div className={styles.field}>
              <span className={styles.label}>Route / equipment / dimension review</span>
              <ChoiceGroup
                label="Route / equipment / dimension review"
                options={[
                  { value: 'reviewed', label: 'Reviewed' },
                  { value: 'pending', label: 'Pending' },
                ]}
                value={plan.reviewed ? 'reviewed' : 'pending'}
                onChange={(value) => patch({ reviewed: value === 'reviewed' })}
              />
            </div>
          </section>

          {ready ? (
            <div className={styles.done} role="status">
              <Check size={16} aria-hidden="true" />
              <span>{floor.code} plan complete · </span>
              <button type="button" className={styles.reopen} onClick={() => onChange({ ...plan, ready: false })}>
                Reopen
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={!hasPlan || !calibrated || !plan.reviewed}
              onClick={() => onChange({ ...plan, ready: true })}
            >
              Mark {floor.code} plan complete
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
