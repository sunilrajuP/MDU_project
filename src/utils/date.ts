/** Strip time from an ISO date without shifting its calendar date between timezones. */
export function toIsoDateOnly(value: string): string {
  return value.split('T')[0];
}

/**
 * Format a calendar date or timestamp for display using DD/MM/YYYY.
 * Date-only ISO values are interpreted as local calendar dates to avoid
 * timezone shifts; timestamps are displayed in the user's local timezone.
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '';

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else {
    const calendarDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (calendarDate) {
      date = new Date(Number(calendarDate[1]), Number(calendarDate[2]) - 1, Number(calendarDate[3]));
      if (
        date.getFullYear() !== Number(calendarDate[1])
        || date.getMonth() !== Number(calendarDate[2]) - 1
        || date.getDate() !== Number(calendarDate[3])
      ) return value;
    } else {
      date = new Date(value);
    }
  }

  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}
