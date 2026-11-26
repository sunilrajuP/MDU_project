import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusChip } from '@/components/ui/StatusChip';
import { UNIT_CHECK_TOTAL, UNIT_FINAL_CODE, UNIT_ITEMS } from '../../config/internalConfig';
import { joinList } from '../../logic/common';
import { isUnitComplete, unitDone, unitMissingNames } from '../../logic/internal';
import type { ItemState, UnitState } from '../../model/types';
import { emptyItem, isItemDone, itemIssues } from '../../questions/questionLogic';
import { QuestionCard } from '../../questions/QuestionCard';
import styles from './UnitCard.module.scss';

interface UnitCardProps {
  unit: UnitState;
  floorCode: string;
  jobRef: string;
  defaultExpanded: boolean;
  onChange: (unit: UnitState) => void;
  onRemove: () => void;
}

/** One unit: the same 8 questions as every other unit, with its own independent answers and evidence. */
export function UnitCard({ unit, floorCode, jobRef, defaultExpanded, onChange, onRemove }: Readonly<UnitCardProps>) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const done = unitDone(unit);
  const complete = isUnitComplete(unit);
  const missing = unitMissingNames(unit);
  const finalDef = UNIT_ITEMS.find((def) => def.code === UNIT_FINAL_CODE) ?? UNIT_ITEMS[UNIT_ITEMS.length - 1];
  const finalState = unit.items[finalDef.code] ?? emptyItem();

  const othersDone = UNIT_ITEMS.filter((def) => def.code !== finalDef.code).every((def) => isItemDone(unit.items[def.code]));
  const canMarkComplete = othersDone && itemIssues(finalDef, finalState, unit.label).count === 0;

  function setItem(code: string, next: ItemState) {
    // Reopening any confirmed item reopens the unit too.
    onChange({ ...unit, items: { ...unit.items, [code]: next }, completed: unit.completed && next.confirmed });
  }

  function markComplete() {
    onChange({ ...unit, items: { ...unit.items, [finalDef.code]: { ...finalState, confirmed: true } }, completed: true });
  }

  return (
    <section className={[styles.unit, expanded ? styles.open : ''].filter(Boolean).join(' ')} aria-label={`Unit ${unit.label}`}>
      <div className={styles.header}>
        <div className={styles.titles}>
          <h4 className={styles.title}>Unit {unit.label}</h4>
          <p className={styles.sub}>
            {floorCode} · {complete ? 'Complete' : 'Draft saved locally'} · {done}/{UNIT_CHECK_TOTAL} checks complete
          </p>
        </div>
        <StatusChip tone={complete ? 'success' : 'brand'}>{complete ? 'Complete' : `Draft · ${done}/${UNIT_CHECK_TOTAL}`}</StatusChip>
        <button type="button" className={styles.iconButton} onClick={() => setConfirmingRemove(true)} aria-label={`Remove unit ${unit.label}`}>
          <Trash2 size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} unit ${unit.label}`}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        </button>
      </div>

      {expanded && (
        <div className={styles.body}>
          {missing.length > 0 && (
            <Callout tone="warning">Unit evidence is independent. Missing: {joinList(missing)}.</Callout>
          )}
          {complete && (
            <Callout tone="success">
              <Check size={14} aria-hidden="true" /> Unit {unit.label} is complete. Completing a unit does not complete the floor or building record.
            </Callout>
          )}

          {UNIT_ITEMS.map((def) => (
            <QuestionCard
              key={def.code}
              def={def}
              state={unit.items[def.code] ?? emptyItem()}
              variant="checklist"
              jobRef={jobRef}
              subject={unit.label}
              floorCode={floorCode}
              context={{
                sectionKey: 'internal',
                floorCode,
                unitId: unit.id,
                tag: `${floorCode} · ${unit.label} · ${def.code}`,
              }}
              hideConfirm={def.code === finalDef.code || def.auto}
              onChange={(next) => setItem(def.code, next)}
              footer={
                def.code === finalDef.code && !unit.completed ? (
                  <>
                    <Button type="button" variant="secondary" disabled={!canMarkComplete} onClick={markComplete}>
                      Mark unit complete
                    </Button>
                    <p className={styles.hint}>Completing this unit does not complete the floor or building record.</p>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      {confirmingRemove && (
        <ConfirmDialog
          title={`Remove unit ${unit.label}?`}
          message="This deletes the unit's answers and evidence. Other units and the floor checklist are not affected, and the unit number is not reused."
          confirmLabel="Remove unit"
          destructive
          onCancel={() => setConfirmingRemove(false)}
          onConfirm={() => {
            setConfirmingRemove(false);
            onRemove();
          }}
        />
      )}
    </section>
  );
}
