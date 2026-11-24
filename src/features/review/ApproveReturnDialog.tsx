import { useState } from 'react';
import { X } from 'lucide-react';
import type { TransitionAction } from '@/types/domain';
import { Button } from '@/components/ui/Button';
import styles from './ApproveReturnDialog.module.scss';

interface ApproveReturnDialogProps {
  action: TransitionAction;
  submitting?: boolean;
  errorMessage?: string;
  onConfirm: (reason: string, comments: string) => void;
  onClose: () => void;
}

export function ApproveReturnDialog({ action, submitting, errorMessage, onConfirm, onClose }: ApproveReturnDialogProps) {
  const [reason, setReason] = useState('');
  const [comments, setComments] = useState('');
  const isApprove = action === 'approve';

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label={isApprove ? 'Approve job' : 'Return job'}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h2 className={styles.title}>{isApprove ? 'Approve submission' : 'Return for rework'}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <label className={styles.label}>
          Reason
          <input
            className={styles.input}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isApprove ? 'e.g. Meets standard' : 'e.g. Missing riser photos'}
          />
        </label>

        <label className={styles.label}>
          Comments
          <textarea
            className={styles.textarea}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
          />
        </label>

        {errorMessage && (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        )}

        <Button
          type="button"
          variant={isApprove ? 'primary' : 'danger'}
          disabled={!reason.trim() || submitting}
          onClick={() => onConfirm(reason, comments)}
        >
          {submitting ? 'Saving…' : isApprove ? 'Approve' : 'Return'}
        </Button>
      </div>
    </div>
  );
}
