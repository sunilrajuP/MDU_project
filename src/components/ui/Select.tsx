import { useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Select.module.scss';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string;
  options: SelectOption[];
  /** `filter` is the compact bold list filter (label is announced but not shown). */
  variant?: 'field' | 'filter';
  error?: string;
}

/** Native select (accessible, touch-friendly) styled like the Figma dropdown fields. */
export function Select({ label, options, variant = 'field', error, id, className, ...rest }: Readonly<SelectProps>) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const isFilter = variant === 'filter';
  return (
    <div className={[styles.field, isFilter ? styles.filterField : '', className].filter(Boolean).join(' ')}>
      <label htmlFor={selectId} className={isFilter ? styles.srOnly : styles.label}>
        {label}
      </label>
      <div className={styles.wrap}>
        <select
          id={selectId}
          className={[styles.select, isFilter ? styles.filter : '', error ? styles.invalid : ''].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className={styles.chevron} size={18} aria-hidden="true" />
      </div>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
