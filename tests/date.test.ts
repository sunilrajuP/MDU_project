import { describe, expect, it } from 'vitest';
import { formatDate, toIsoDateOnly } from '@/utils/date';

describe('toIsoDateOnly', () => {
  it.each([
    ['2026-11-16T23:30:00.000Z', '2026-11-16'],
    ['2026-11-18T00:30:00+05:30', '2026-11-18'],
    ['2026-11-16', '2026-11-16'],
  ])('strips time without timezone conversion from %s', (value, expected) => {
    expect(toIsoDateOnly(value)).toBe(expected);
  });
});

describe('formatDate', () => {
  it('formats ISO calendar dates as zero-padded DD/MM/YYYY without timezone shifts', () => {
    expect(formatDate('2026-11-08')).toBe('08/11/2026');
  });

  it('formats ISO timestamps using the local calendar date', () => {
    expect(formatDate('2026-11-16T09:30:00Z')).toBe(
      formatDate(new Date('2026-11-16T09:30:00Z')),
    );
  });

  it('handles missing and invalid values safely', () => {
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('not-a-date')).toBe('not-a-date');
    expect(formatDate('2026-02-30')).toBe('2026-02-30');
  });
});
