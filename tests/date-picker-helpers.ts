import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';

export async function chooseCalendarDate(input: HTMLElement, value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const targetMonth = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  fireEvent.click(input);
  await screen.findByRole('dialog', { name: 'Choose scheduled date' });

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const heading = screen.getByRole('heading', { level: 2 }).textContent ?? '';
    if (heading === targetMonth) break;
    const [shownMonth, shownYear] = heading.split(' ');
    const shownDate = new Date(`${shownMonth} 1, ${shownYear}`);
    const targetDate = new Date(year, month - 1, 1);
    fireEvent.click(screen.getByRole('button', {
      name: targetDate < shownDate ? 'Previous month' : 'Next month',
    }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 }).textContent).not.toBe(heading);
    });
  }

  const date = new Date(year, month - 1, day);
  const accessibleName = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  fireEvent.click(screen.getByRole('button', { name: accessibleName }));
}
