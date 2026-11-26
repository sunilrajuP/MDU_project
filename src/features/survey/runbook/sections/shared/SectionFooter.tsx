import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import styles from './SectionFooter.module.scss';

interface SectionFooterProps {
  notes: string;
  onNotesChange: (value: string) => void;
  /** All requirements met: the Section Complete button is enabled. */
  canComplete: boolean;
  /** The section is already confirmed. */
  complete: boolean;
  onComplete: () => void;
  /** Shown while blocked, e.g. "Resolve external conduit sealing condition before marking this section complete." */
  blockedHint: string;
  /** Shown once complete, e.g. "WHS record complete · Saved locally · Pending sync". */
  completeHint: string;
  notesLabel?: string;
  notesError?: string;
}

/** The mandatory "Site surveyor notes" box and the "Section Complete" button used at the foot of most sections. */
export function SectionFooter({
  notes,
  onNotesChange,
  canComplete,
  complete,
  onComplete,
  blockedHint,
  completeHint,
  notesLabel = 'SITE SURVEYOR NOTES * (MANDATORY)',
  notesError,
}: Readonly<SectionFooterProps>) {
  return (
    <div className={styles.footer}>
      <Textarea
        label={notesLabel}
        rows={2}
        value={notes}
        placeholder="Not recorded"
        error={notesError}
        onChange={(event) => onNotesChange(event.target.value)}
      />
      <Button
        type="button"
        variant={canComplete || complete ? 'primary' : 'secondary'}
        className={styles.complete}
        disabled={!canComplete && !complete}
        onClick={onComplete}
      >
        <Check size={16} aria-hidden="true" /> Section Complete
      </Button>
      <p className={styles.hint}>{complete && canComplete ? completeHint : blockedHint}</p>
    </div>
  );
}
