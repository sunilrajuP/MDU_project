import { useState } from 'react';
import { X } from 'lucide-react';
import type { AssignmentActor } from '@/types/domain';
import { Button } from '@/components/ui/Button';
import styles from './ReassignSheet.module.scss';

interface ReassignSheetProps {
  title: string;
  targets: { actor: AssignmentActor; name: string }[];
  currentAssigneeId?: string;
  confirmLabel: string;
  errorMessage?: string;
  submitting?: boolean;
  onConfirm: (target: AssignmentActor) => void;
  onClose: () => void;
}

export function ReassignSheet({
  title,
  targets,
  currentAssigneeId,
  confirmLabel,
  errorMessage,
  submitting,
  onConfirm,
  onClose,
}: ReassignSheetProps) {
  const [selectedId, setSelectedId] = useState(currentAssigneeId);
  const selected = targets.find((t) => t.actor.userId === selectedId);

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.sheet}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {targets.length === 0 ? (
          <p className={styles.empty}>No eligible team members available.</p>
        ) : (
          <ul className={styles.options}>
            {targets.map((target) => (
              <li key={target.actor.userId}>
                <button
                  type="button"
                  className={[styles.option, selectedId === target.actor.userId ? styles.optionSelected : ''].join(
                    ' ',
                  )}
                  onClick={() => setSelectedId(target.actor.userId)}
                >
                  <span className={styles.avatar}>{target.name.charAt(0)}</span>
                  <span className={styles.info}>
                    <span className={styles.name}>{target.name}</span>
                    <span className={styles.role}>{target.actor.role}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {errorMessage && (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        )}

        <Button
          type="button"
          disabled={!selected || submitting}
          onClick={() => selected && onConfirm(selected.actor)}
        >
          {submitting ? 'Assigning…' : confirmLabel}
        </Button>
      </div>
    </div>
  );
}
