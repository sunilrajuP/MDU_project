import { useEffect, useId, useRef, useState } from 'react';
import { useLazySearchAddressesQuery } from '@/api/addressApi';
import type { AddressSuggestion } from '@/types/api';
import field from './FormField.module.scss';
import styles from './AddressAutocomplete.module.scss';

interface Props {
  label: string;
  value: string;
  selected: boolean;
  required?: boolean;
  onChange: (text: string) => void;
  onSelect: (s: AddressSuggestion) => void;
  placeholder?: string;
}

const SEARCH_DEBOUNCE_MS = 500;

export function AddressAutocomplete({ label, value, selected, required, onChange, onSelect, placeholder }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [search, result] = useLazySearchAddressesQuery();
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  const query = value.trim();
  const matchesQuery = !selected && query.length >= 3 && result.originalArgs === query;
  const loading = matchesQuery && result.isFetching;
  const items = matchesQuery && !loading ? result.currentData ?? [] : [];
  const error = matchesQuery && result.isError ? 'Address search failed. Try again or enter the address manually.' : undefined;

  useEffect(() => {
    if (selected || query.length < 3) return;
    let request: ReturnType<typeof search> | undefined;
    const timer = setTimeout(() => {
      request = search(query, true);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      request?.abort();
    };
  }, [query, selected, search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function choose(s: AddressSuggestion) {
    onSelect(s);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Enter' && active >= 0 && active < items.length) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && !selected && (items.length > 0 || loading);

  return (
    <div className={field.field} ref={rootRef}>
      <label className={field.label} htmlFor={id}>
        {label}
        {required && <span className={field.required} aria-hidden="true" style={{ color: '#dc2626' }}>*</span>}
      </label>
      <div className={field.wrap}>
        <input
          id={id}
          className={field.control}
          value={value}
          required={required}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 && active < items.length ? `${id}-opt-${active}` : undefined}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <span className={field.icon} aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />
          </svg>
        </span>

        {showList && (
          <ul id={listId} role="listbox" className={styles.list}>
            {loading && items.length === 0 && <li className={styles.status}>Searching…</li>}
            {items.map((s, i) => (
              <li
                key={s.id}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className={`${styles.option} ${i === active ? styles.active : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
                onMouseEnter={() => setActive(i)}
              >
                <strong>{s.primary}</strong>
                <span>{s.secondary}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selected && <span className={field.hint}>Complete address selected</span>}
      {error && <span className={field.hint} role="alert">{error}</span>}
    </div>
  );
}