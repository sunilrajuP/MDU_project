import styles from './ChoiceGroup.module.scss';

export interface ChoiceOption {
  value: string;
  label: string;
}

interface BaseProps {
  /** Accessible group name (usually the question text). */
  label: string;
  options: ChoiceOption[];
  disabled?: boolean;
  /** Colour of the selected chip; `warning` is used for "Absent-photo" style states in Figma. */
  selectedTone?: 'brand' | 'warning';
  className?: string;
}

interface SingleProps extends BaseProps {
  multiple?: false;
  value: string | null;
  onChange: (value: string) => void;
}

interface MultiProps extends BaseProps {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
}

/**
 * Chip selector used for Yes / No / N/A toggles and every choice list in the runbook.
 * Single mode behaves like a radio group; multi mode like a set of toggles.
 */
export function ChoiceGroup(props: Readonly<SingleProps | MultiProps>) {
  const { label, options, disabled, selectedTone = 'brand', className } = props;
  const selected = props.multiple ? props.value : props.value ? [props.value] : [];

  function toggle(value: string) {
    if (props.multiple) {
      props.onChange(selected.includes(value) ? selected.filter((entry) => entry !== value) : [...selected, value]);
    } else {
      props.onChange(value);
    }
  }

  return (
    <div
      className={[styles.group, className].filter(Boolean).join(' ')}
      role={props.multiple ? 'group' : 'radiogroup'}
      aria-label={label}
    >
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            role={props.multiple ? undefined : 'radio'}
            aria-checked={props.multiple ? undefined : isSelected}
            aria-pressed={props.multiple ? isSelected : undefined}
            disabled={disabled}
            className={[styles.chip, isSelected ? styles.selected : '', isSelected ? styles[selectedTone] : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => toggle(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
