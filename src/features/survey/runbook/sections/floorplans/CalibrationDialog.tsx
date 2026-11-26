import { useState, type MouseEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useMediaBlob, useObjectUrl } from '../../../capture/hooks';
import type { Calibration } from '../../model/types';
import { parseNumber } from '../../questions/questionLogic';
import styles from './CalibrationDialog.module.scss';

interface CalibrationDialogProps {
  /** The plan sheet to calibrate. */
  mediaId: string;
  initial: Calibration | null;
  /** Which point the surveyor opened the dialog to place. */
  start: 'A' | 'B';
  onClose: () => void;
  onSave: (calibration: Calibration) => void;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Two-point calibration: click A then B on the plan, enter the real distance; the scale is derived from both. */
export function CalibrationDialog({ mediaId, initial, start, onClose, onSave }: Readonly<CalibrationDialogProps>) {
  const { blob } = useMediaBlob(mediaId);
  const url = useObjectUrl(blob);
  const [pointA, setPointA] = useState(initial?.pointA ?? null);
  const [pointB, setPointB] = useState(initial?.pointB ?? null);
  const [placing, setPlacing] = useState<'A' | 'B'>(start);
  const [distance, setDistance] = useState(initial?.distanceM ?? '');
  const [aspect, setAspect] = useState(initial?.imageAspect ?? 1);
  const [attempted, setAttempted] = useState(false);

  const parsed = parseNumber(distance);
  const distanceOk = parsed !== null && parsed > 0;
  const ready = !!pointA && !!pointB && distanceOk;

  function place(event: MouseEvent<HTMLImageElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const point: [number, number] = [clamp((event.clientX - rect.left) / rect.width), clamp((event.clientY - rect.top) / rect.height)];
    if (placing === 'A') {
      setPointA(point);
      setPlacing('B');
    } else {
      setPointB(point);
    }
  }

  function save() {
    setAttempted(true);
    if (ready) onSave({ pointA, pointB, distanceM: distance.trim(), imageAspect: aspect });
  }

  return (
    <Modal
      title="Calibrate floor plan"
      subtitle="Select point A and point B on the plan, then enter the real-world distance between them."
      onClose={onClose}
      footer={
        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={save}>
            Save calibration
          </Button>
        </div>
      }
    >
      {url ? (
        <div className={styles.stage}>
          <img
            src={url}
            alt="Floor plan: click to place the calibration points"
            className={styles.image}
            onClick={place}
            onLoad={(event) => setAspect(event.currentTarget.naturalWidth / (event.currentTarget.naturalHeight || 1))}
          />
          {pointA && <span className={styles.marker} style={{ left: `${pointA[0] * 100}%`, top: `${pointA[1] * 100}%` }}>A</span>}
          {pointB && <span className={styles.marker} style={{ left: `${pointB[0] * 100}%`, top: `${pointB[1] * 100}%` }}>B</span>}
        </div>
      ) : (
        <Callout tone="warning">The plan image is not stored on this device, so it cannot be calibrated here.</Callout>
      )}

      <div className={styles.toolbar} role="group" aria-label="Point to place">
        {(['A', 'B'] as const).map((point) => (
          <Button key={point} type="button" variant={placing === point ? 'primary' : 'outline'} onClick={() => setPlacing(point)}>
            Place point {point}
          </Button>
        ))}
      </div>

      <Input
        label="Real-world distance between A and B (m)"
        inputMode="decimal"
        value={distance}
        onChange={(event) => setDistance(event.target.value)}
        error={attempted && !distanceOk ? 'Enter the distance in metres.' : undefined}
      />
      {attempted && (!pointA || !pointB) && (
        <p className={styles.error} role="alert">
          Select both point A and point B on the plan.
        </p>
      )}
    </Modal>
  );
}
