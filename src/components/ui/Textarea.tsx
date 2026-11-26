import { useId, type TextareaHTMLAttributes } from 'react';
import styles from './Textarea.module.scss';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function Textarea({ label, hint, error, id, rows = 3, ...rest }: Readonly<TextareaProps>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const messageId = `${fieldId}-message`;
  return (
    <div className={styles.field}>
      <label htmlFor={fieldId} className={styles.label}>
        {label}
      </label>
      <textarea
        id={fieldId}
        rows={rows}
        className={[styles.textarea, error ? styles.invalid : ''].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        {...rest}
      />
      {hint && !error && (
        <span id={messageId} className={styles.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={messageId} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
