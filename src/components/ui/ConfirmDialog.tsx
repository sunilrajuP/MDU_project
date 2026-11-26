import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import styles from './ConfirmDialog.module.scss';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive (removals). */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Small centred confirmation (used before removals). Escape and Cancel both dismiss without acting. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: Readonly<ConfirmDialogProps>) {
  return (
    <Modal
      size="sm"
      title={title}
      onClose={onCancel}
      closeLabel="Close dialog"
      footer={
        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className={styles.message}>{message}</p>
    </Modal>
  );
}
