import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '@/utils/date';
import field from './FormField.module.scss';
import styles from './DatePicker.module.scss';

interface DatePickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

function parseDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : undefined;
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getCalendarDays(month: Date): Date[] {
  const firstDay = monthStart(month);
  const start = new Date(firstDay.getFullYear(), firstDay.getMonth(), -firstDay.getDay() + 1);
  return Array.from({ length: 42 }, (_, index) => (
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
  ));
}

function formatMonth(month: Date): string {
  return month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatAccessibleDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DatePicker({
  id,
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = 'Select date',
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseDate(value);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(selectedDate ?? new Date()));
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogId = `${id}-calendar`;
  const today = toDateOnly(new Date());
  const calendarDays = getCalendarDays(visibleMonth);

  useEffect(() => {
    const handleOutsidePointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsidePointer);
    return () => document.removeEventListener('mousedown', handleOutsidePointer);
  }, []);

  function showCalendar() {
    setVisibleMonth(monthStart(selectedDate ?? new Date()));
    setOpen(true);
  }

  function chooseDate(date: Date) {
    onChange(toDateOnly(date));
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === 'ArrowDown' || event.key === ' ') {
      event.preventDefault();
      if (open) return;
      showCalendar();
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className={`${field.wrap} ${styles.root}`} ref={rootRef}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        className={`${field.control} ${styles.input}`}
        value={value ? formatDate(value) : ''}
        placeholder={placeholder}
        readOnly
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        aria-required={required}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : showCalendar())}
        onKeyDown={handleInputKeyDown}
      />
      <span className={field.icon} aria-hidden="true">
        <CalendarDays size={18} />
      </span>
      {open && (
        <section
          id={dialogId}
          className={styles.calendar}
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              inputRef.current?.focus();
            }
          }}
        >
          <div className={styles.header}>
            <button
              type="button"
              className={styles.monthButton}
              aria-label="Previous month"
              onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))}
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className={styles.monthTitle} aria-live="polite">{formatMonth(visibleMonth)}</h2>
            <button
              type="button"
              className={styles.monthButton}
              aria-label="Next month"
              onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <table className={styles.monthGrid}>
            <thead>
              <tr>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, index) => (
                  <th key={day} scope="col">
                    <span aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index]}>
                      {day}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }, (_, week) => (
                <tr key={week}>
                  {calendarDays.slice(week * 7, week * 7 + 7).map((date) => {
                    const dateValue = toDateOnly(date);
                    const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
                    const isSelected = dateValue === value;
                    return (
                      <td key={dateValue}>
                        <button
                          type="button"
                          className={`${styles.day} ${!isCurrentMonth ? styles.outsideMonth : ''} ${isSelected ? styles.selectedDay : ''} ${dateValue === today ? styles.today : ''}`}
                          aria-label={formatAccessibleDate(date)}
                          aria-pressed={isSelected}
                          onClick={() => chooseDate(date)}
                        >
                          {date.getDate()}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                onChange('');
                setOpen(false);
                inputRef.current?.focus();
              }}
            >
              Clear
            </button>
            <button type="button" className={styles.action} onClick={() => chooseDate(new Date())}>
              Today
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
