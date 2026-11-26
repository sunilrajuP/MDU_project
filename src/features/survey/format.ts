/** "Thursday, 1 October 2026" (the My Jobs app-bar subtitle). */
export function formatLongDate(date: Date = new Date()): string {
  const weekday = date.toLocaleDateString('en-AU', { weekday: 'long' });
  const rest = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${weekday}, ${rest}`;
}

/** Date-only ISO strings are calendar dates: parse as local to avoid timezone shifts. */
function parseCalendarDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
}

/** "1 Oct 2026". */
export function formatShortDate(value: string): string {
  return parseCalendarDate(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "1 OCT 2026" (small uppercase meta lines). */
export function formatShortDateUpper(value: string): string {
  return formatShortDate(value).toUpperCase();
}

/** "09:41" in the device's local time. */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "−37.81210, 144.97270" (typographic minus, as in the design). */
export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5).replace('-', '−')}, ${longitude.toFixed(5)}`;
}

/** "28 Oct, 09:12 am" */
export function formatCompletedAt(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${day}, ${time}`;
}
