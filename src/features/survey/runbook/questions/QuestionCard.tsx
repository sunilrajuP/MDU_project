import { useId, useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronUp, Image as ImageIcon, Minus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { ChoiceGroup } from '@/components/ui/ChoiceGroup';
import { Input } from '@/components/ui/Input';
import { StatusChip } from '@/components/ui/StatusChip';
import { Textarea } from '@/components/ui/Textarea';
import type { ItemStatus, MediaContext } from '@/types/surveyor';
import { EvidenceCapture } from '../../capture/EvidenceCapture';
import type { FieldValue, ItemState } from '../model/types';
import {
  chipValue,
  evidenceVisible,
  itemIssues,
  itemStatus,
  parseNumber,
  statusLabel,
  statusTone,
  textOf,
} from './questionLogic';
import type { CardVariant, ChoiceField, FieldDef, QuestionDef } from './questionTypes';
import styles from './QuestionCard.module.scss';

interface QuestionCardProps {
  def: QuestionDef;
  state: ItemState;
  onChange: (next: ItemState) => void;
  variant: CardVariant;
  jobRef: string;
  /** Where captured evidence belongs (itemCode is added from `def`). */
  context: Omit<MediaContext, 'itemCode'>;
  /** Names the thing being answered in messages, e.g. a unit label "B1-01". */
  subject?: string;
  /** Numbered badge (floor / basement checklists). */
  number?: number;
  /** External variant meta line, e.g. "Mandatory · Blocks sign-off". */
  metaLine?: string;
  /** Show validation errors immediately (e.g. after a failed Section Complete). */
  forceShowErrors?: boolean;
  /** Replaces the Confirm button (e.g. "Mark unit complete"). */
  hideConfirm?: boolean;
  footer?: ReactNode;
  floorCode?: string;
  disabled?: boolean;
}

function StatusIcon({ status }: Readonly<{ status: ItemStatus }>) {
  const tone = statusTone(status);
  return (
    <span className={[styles.statusIcon, styles[`icon_${tone}`]].join(' ')} aria-hidden="true">
      {tone === 'success' ? <Check size={14} /> : status === 'not_applicable' ? <Minus size={14} /> : '!'}
    </span>
  );
}

/** External cards only ever read "Captured · Confirmed", "Incomplete" or "N/A"; checklist cards show the status or value. */
function chipLabel(variant: CardVariant, status: ItemStatus, def: QuestionDef, state: ItemState): string {
  if (variant === 'external') {
    if (status === 'captured') return 'Captured · Confirmed';
    return status === 'not_applicable' ? 'N/A' : 'Incomplete';
  }
  return (status === 'captured' && chipValue(def, state)) || statusLabel(status);
}

function limitHint(field: FieldDef, state: ItemState): string | undefined {
  if (field.kind !== 'number' || !field.limit) return undefined;
  const parsed = parseNumber(state.values[field.code]);
  if (parsed === null) return undefined;
  const { max, unit } = field.limit;
  return parsed <= max ? `${parsed} ${unit} is within the ${max} ${unit} limit.` : `${parsed} ${unit} exceeds the ${max} ${unit} limit.`;
}

interface FieldProps {
  field: FieldDef;
  state: ItemState;
  error?: string;
  disabled?: boolean;
  onValue: (code: string, value: FieldValue) => void;
}

function Field({ field, state, error, disabled, onValue }: Readonly<FieldProps>) {
  // Unique per field instance: Input derives its id from the label, which repeats across cards.
  const fieldId = useId();
  const value = state.values[field.code];
  if (field.kind === 'choice') {
    const choice = field as ChoiceField;
    const selectedWarn = !choice.multiple && choice.warnOn?.includes(textOf(value));
    return (
      <div className={styles.fieldBlock}>
        <span className={styles.fieldLabel}>{field.label}</span>
        {choice.multiple ? (
          <ChoiceGroup
            multiple
            label={field.label}
            options={choice.options}
            value={Array.isArray(value) ? value : []}
            disabled={disabled}
            onChange={(next) => onValue(field.code, next)}
          />
        ) : (
          <ChoiceGroup
            label={field.label}
            options={choice.options}
            value={textOf(value) || null}
            disabled={disabled}
            selectedTone={selectedWarn ? 'warning' : 'brand'}
            onChange={(next) => onValue(field.code, next)}
          />
        )}
        {error && (
          <span className={styles.error} role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }

  const label = field.kind === 'number' && field.unit && !field.label.includes('(') ? `${field.label} (${field.unit})` : field.label;
  if (field.kind === 'text' && field.multiline) {
    return (
      <Textarea
        label={label}
        value={textOf(value)}
        placeholder={field.placeholder ?? 'Not recorded'}
        error={error}
        disabled={disabled}
        onChange={(event) => onValue(field.code, event.target.value)}
      />
    );
  }
  return (
    <Input
      id={fieldId}
      label={label}
      value={textOf(value)}
      placeholder={(field.kind === 'text' || field.kind === 'number') && field.placeholder ? field.placeholder : 'Not recorded'}
      inputMode={field.kind === 'number' ? 'decimal' : undefined}
      hint={limitHint(field, state)}
      error={error}
      disabled={disabled}
      onChange={(event) => onValue(field.code, event.target.value)}
    />
  );
}

/**
 * One checklist question, rendered from its definition. Used by External Network (external layout) and by the
 * Internal Network building / floor / basement / unit checks (checklist layout).
 */
export function QuestionCard({
  def,
  state,
  onChange,
  variant,
  jobRef,
  context,
  subject = '',
  number,
  metaLine,
  forceShowErrors = false,
  hideConfirm = false,
  footer,
  floorCode,
  disabled = false,
}: Readonly<QuestionCardProps>) {
  // External cards stay open (as drawn); checklist cards collapse once confirmed.
  const [expanded, setExpanded] = useState(variant === 'external' || !state.confirmed);
  const [touched, setTouched] = useState(false);

  const showErrors = touched || forceShowErrors;
  const issues = itemIssues(def, state, subject);
  const status = itemStatus(def, state, showErrors, subject);
  const locked = disabled || state.confirmed;
  const chipText = chipLabel(variant, status, def, state);
  const tone = statusTone(status);

  const setValue = (code: string, value: FieldValue) => onChange({ ...state, values: { ...state.values, [code]: value } });
  const setConfirmed = (confirmed: boolean) => {
    onChange({ ...state, confirmed });
    if (variant !== 'external') setExpanded(!confirmed);
  };

  const missing = [
    ...def.fields.filter((field) => issues.fields[field.code]).map((field) => field.label.toLowerCase()),
    ...(issues.evidence ? ['photo or video evidence'] : []),
    ...(issues.anyOf ? [def.anyOf?.missing ?? 'required details'] : []),
  ];

  const body = (
    <div className={styles.body} onBlurCapture={() => setTouched(true)}>
      {def.banner && <Callout tone="warning">{def.banner}</Callout>}
      {def.hint && <p className={styles.hint}>{def.hint}</p>}
      {def.reference && (
        <div className={styles.reference}>
          <span className={styles.referenceThumb} aria-hidden="true">
            <ImageIcon size={20} />
          </span>
          <span>
            Reference: {def.reference} · EXAMPLE ONLY
          </span>
        </div>
      )}

      {def.fields.map((field) => (
        <Field
          key={field.code}
          field={field}
          state={state}
          error={showErrors ? issues.fields[field.code] : undefined}
          disabled={locked}
          onValue={setValue}
        />
      ))}

      {def.footnote && def.footnote(state) && <p className={styles.footnote}>{def.footnote(state)}</p>}

      {evidenceVisible(def, state) && (
        <div className={styles.evidence}>
          {def.evidence && def.evidence.min > 0 && state.media.length > 0 && (
            <p className={styles.hint}>Add further evidence if required.</p>
          )}
          <EvidenceCapture
            jobRef={jobRef}
            context={{ ...context, itemCode: def.code }}
            itemLabel={def.label}
            value={state.media}
            allowVideo={def.evidence?.video !== false}
            disabled={locked}
            onChange={(media) => onChange({ ...state, media })}
          />
          {issues.evidence && def.evidence?.pendingHint && showErrors && (
            <p className={styles.error}>{def.evidence.pendingHint}</p>
          )}
        </div>
      )}

      {def.reuseEvidence && (
        <Button type="button" variant="outline" disabled title="Reusing evidence is not built yet">
          Reuse existing evidence · same {floorCode ?? context.floorCode ?? 'floor'} asset only
        </Button>
      )}

      {def.helper && <p className={styles.hint}>{def.helper}</p>}

      {issues.anyOf && showErrors && (
        <p className={styles.error} role="alert">
          {issues.anyOf}
        </p>
      )}

      {state.confirmed && !def.auto ? (
        <div className={styles.confirmed} role="status">
          <Check size={16} aria-hidden="true" />
          <span>Item confirmed complete · </span>
          <button type="button" className={styles.reopen} onClick={() => setConfirmed(false)} disabled={disabled}>
            Reopen to update
          </button>
        </div>
      ) : (
        !state.confirmed &&
        !hideConfirm &&
        !state.na && (
          <>
            <Button
              type="button"
              variant="secondary"
              className={styles.confirm}
              disabled={disabled || issues.count > 0}
              onClick={() => setConfirmed(true)}
            >
              <Check size={16} aria-hidden="true" /> Confirm item complete
            </Button>
            {issues.count > 0 && showErrors && missing.length > 0 && (
              <p className={styles.hint}>
                Capture the required evidence first, then confirm. Missing: {missing.join(', ')}.
              </p>
            )}
          </>
        )
      )}

      {footer}
    </div>
  );

  const toggle = (
    <button
      type="button"
      className={styles.chevron}
      aria-expanded={expanded}
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${def.label}`}
      onClick={() => setExpanded((open) => !open)}
    >
      {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
    </button>
  );

  if (variant === 'external') {
    return (
      <section className={[styles.card, styles.external, showErrors && issues.count > 0 ? styles.invalid : ''].filter(Boolean).join(' ')} aria-label={def.label}>
        <h3 className={styles.externalTitle}>{def.label}</h3>
        {metaLine && <p className={styles.meta}>{metaLine}</p>}
        <div className={styles.statusRow}>
          <StatusChip tone={tone}>{chipText}</StatusChip>
          {toggle}
        </div>
        <div className={styles.naRow}>
          <button
            type="button"
            className={[styles.na, state.na ? styles.naOn : ''].filter(Boolean).join(' ')}
            aria-pressed={!!state.na}
            disabled={disabled || state.confirmed}
            onClick={() => onChange({ ...state, na: !state.na })}
          >
            — N/A
          </button>
        </div>
        {expanded && body}
      </section>
    );
  }

  return (
    <section className={[styles.card, showErrors && issues.count > 0 ? styles.invalid : ''].filter(Boolean).join(' ')} aria-label={def.label}>
      <div className={styles.header}>
        <StatusIcon status={status} />
        {number !== undefined && <span className={styles.number}>{number}</span>}
        <h3 className={styles.title}>
          {def.label}
          {def.required ? ' *' : ''}
        </h3>
        <StatusChip tone={tone}>{chipText}</StatusChip>
        {toggle}
      </div>
      {expanded && body}
    </section>
  );
}
