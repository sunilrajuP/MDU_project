import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from '@/components/ui/DatePicker';

describe('DatePicker', () => {
  it('shows a styled calendar, navigates months, and emits an ISO date', () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="scheduled">Scheduled Date</label>
        <DatePicker id="scheduled" label="Scheduled Date" value="2026-12-03" onChange={onChange} required />
      </>,
    );

    const input = screen.getByLabelText('Scheduled Date');
    expect((input as HTMLInputElement).value).toBe('03/12/2026');
    fireEvent.click(input);

    expect(screen.getByRole('dialog', { name: 'Choose scheduled date' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeTruthy();
    expect(input.getAttribute('aria-required')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'January 2027' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thursday, December 3, 2026' }));

    expect(onChange).toHaveBeenCalledWith('2026-12-03');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clears the selected date and closes with Escape', () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="scheduled">Scheduled Date</label>
        <DatePicker id="scheduled" label="Scheduled Date" value="2026-12-03" onChange={onChange} />
      </>,
    );
    const input = screen.getByLabelText('Scheduled Date');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith('');

    fireEvent.click(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
