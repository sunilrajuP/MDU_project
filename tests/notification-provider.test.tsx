import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '@/components/ui/NotificationProvider';
import { useNotification } from '@/components/ui/notificationContext';

function NotificationTrigger() {
  const notification = useNotification();
  return (
    <button
      type="button"
      onClick={() => notification?.showNotification({ kind: 'success', message: 'Job created successfully.' })}
    >
      Show notification
    </button>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('NotificationProvider', () => {
  it('automatically dismisses a notification after three seconds', () => {
    vi.useFakeTimers();
    render(
      <NotificationProvider>
        <NotificationTrigger />
      </NotificationProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show notification' }));
    expect(screen.getByRole('status').textContent).toBe('Job created successfully.');

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByRole('status').textContent).toBe('Job created successfully.');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Dismiss notification' })).toBeNull();
  });
});
