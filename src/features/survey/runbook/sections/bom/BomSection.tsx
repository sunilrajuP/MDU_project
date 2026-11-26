import { useState } from 'react';
import { Check, Download, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { StatusChip } from '@/components/ui/StatusChip';
import type { BomRow } from '@/types/surveyor';
import { bomLogic, bomQuantity, confirmedRows, fittingsMissing, isRowConfirmed } from '../../logic/bom';
import { planOf, readyCount } from '../../logic/floorPlans';
import { useRunbook } from '../../state/runbookContext';
import { downloadBomCsv } from './bomExport';
import styles from './BomSection.module.scss';

const SOURCE_LABEL = { plan: 'PLAN', calculated: 'CALCULATED', manual: 'MANUAL' } as const;

/** Section 7: BoM Review & Confirm. A draft estimate the surveyor reviews row by row; any change resets confirmation. */
export function BomSection() {
  const { model, update, setCompleted, pendingSections } = useRunbook();
  const rows = model.bomRows;
  const [editing, setEditing] = useState<string | null>(null);

  const total = rows.length;
  const confirmed = confirmedRows(model);
  const issues = bomLogic.issues(model);
  const complete = model.completed.bom && issues.length === 0;

  const floors = model.data.internal.floors;
  const plansMissing = floors.every((floor) => planOf(model.data.floorPlans, floor.code).media.length === 0);
  const plansPending = readyCount(model.data.floorPlans, floors) < floors.length;
  const flagged = rows.find((row) => row.flag && bomQuantity(model, row) === 0 && !isRowConfirmed(model, row));

  /** Any edit resets the confirmation of the whole BoM. */
  function setRow(row: BomRow, change: { confirmed?: boolean; quantity?: string }) {
    update('bom', (current) => ({
      ...current,
      rows: { ...current.rows, [row.id]: { ...current.rows[row.id], confirmed: false, ...change } },
    }));
    setCompleted('bom', false);
  }

  if (total === 0) return <Callout tone="warning">The draft bill of materials is not available yet. Reconnect to load it.</Callout>;

  const unconfirmed = total - confirmed;
  return (
    <>
      <Callout tone="info">
        The BoM derives from floor-plan equipment blocks, tagged dimensions and design inputs. Review and confirm it before
        sign-off. Any change resets confirmation.
      </Callout>
      {(plansPending || unconfirmed > 0) && (
        <Callout tone="warning">
          Draft reference estimate · Not reconciled to this survey. {plansMissing ? 'Plans are still missing; ' : plansPending ? 'Some plans are not ready; ' : ''}
          {unconfirmed === total ? `all ${total} rows remain unconfirmed.` : `${unconfirmed} of ${total} rows remain unconfirmed.`} Quantities are not a live calculation.
        </Callout>
      )}

      <div className={styles.heading}>
        <h3 className={styles.title}>Bill of Materials</h3>
        <Button type="button" variant="outline" onClick={() => downloadBomCsv(model)}>
          <Download size={16} aria-hidden="true" /> Export .csv
        </Button>
      </div>

      <ul className={styles.rows} aria-label="Bill of materials">
        {rows.map((row) => {
          const quantity = bomQuantity(model, row);
          const isConfirmed = isRowConfirmed(model, row);
          const isEditing = editing === row.id;
          return (
            <li key={row.id} className={styles.row}>
              <input
                type="checkbox"
                className={styles.check}
                checked={isConfirmed}
                aria-label={`Confirm ${row.item}`}
                onChange={(event) => setRow(row, { confirmed: event.target.checked })}
              />
              <div className={styles.text}>
                <span className={styles.item}>{row.item}</span>
                <span className={styles.desc}>{row.description}</span>
                {row.flag && quantity === 0 && !isConfirmed && <StatusChip tone="warning">{row.flag}</StatusChip>}
              </div>
              <div className={styles.qty}>
                {isEditing ? (
                  <input
                    className={styles.qtyInput}
                    type="text"
                    inputMode="decimal"
                    aria-label={`Quantity for ${row.item}`}
                    value={model.data.bom.rows[row.id]?.quantity ?? String(row.quantity)}
                    onChange={(event) => setRow(row, { quantity: event.target.value })}
                    autoFocus
                  />
                ) : (
                  <span className={styles.qtyValue}>
                    <strong>{quantity}</strong> <span className={styles.unit}>{row.unit}</span>
                  </span>
                )}
                <span className={[styles.source, styles[row.source]].join(' ')}>{SOURCE_LABEL[row.source]}</span>
              </div>
              <button
                type="button"
                className={styles.edit}
                aria-label={isEditing ? `Finish editing ${row.item}` : `Edit quantity for ${row.item}`}
                aria-pressed={isEditing}
                onClick={() => setEditing(isEditing ? null : row.id)}
              >
                {isEditing ? <Check size={18} aria-hidden="true" /> : <Pencil size={18} aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>

      {fittingsMissing(model) && flagged && (
        <Callout tone="warning">
          {flagged.item.replace(/ \(.*\)/, '')} are {bomQuantity(model, flagged)} {flagged.unit}. Enter an estimate or explicitly confirm none are
          required. Review against the completed plans before sign-off.
        </Callout>
      )}

      <p className={styles.footnote}>
        {confirmed}/{total} rows confirmed · {pendingSections > 0 ? 'Saved locally · Pending sync' : 'Saved'}
      </p>
      <Button
        type="button"
        variant={complete ? 'primary' : 'secondary'}
        disabled={issues.length > 0 && !complete}
        onClick={() => setCompleted('bom', true)}
      >
        {complete ? 'BoM confirmed' : 'Confirm reviewed BoM'}
      </Button>
    </>
  );
}
