import { fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { store } from '@/store';
import { AppShell } from '@/layouts/AppShell';

function renderAppShell(onSignOut = vi.fn()) {
  render(
    <Provider store={store}>
      <MemoryRouter>
        <AppShell
          title="Field Operations"
          roleLabel="Team Lead"
          userName="Alex Morgan"
          navItems={[]}
          bottomNavItems={[]}
          onSignOut={onSignOut}
        >
          <p>Dashboard</p>
        </AppShell>
      </MemoryRouter>
    </Provider>,
  );
  return onSignOut;
}

describe('AppShell account control', () => {
  it('reveals the existing user identity, role, and sign-out action on hover', () => {
    renderAppShell();

    const accountButton = screen.getByRole('button', { name: 'Account for Alex Morgan' });
    expect(accountButton.textContent).toContain('Alex Morgan');
    expect(screen.getAllByText('Alex Morgan')).toHaveLength(2);

    fireEvent.pointerEnter(accountButton.parentElement!, { pointerType: 'mouse' });

    const accountDetails = screen.getByRole('region', { name: 'Account details' });
    expect(within(accountDetails).getByText('Alex Morgan')).toBeTruthy();
    expect(within(accountDetails).getByText('Team Lead')).toBeTruthy();
    expect(within(accountDetails).getByRole('button', { name: 'Sign Out' })).toBeTruthy();
  });

  it('opens by button activation and uses the existing sign-out callback', () => {
    const onSignOut = renderAppShell();
    const accountButton = screen.getByRole('button', { name: 'Account for Alex Morgan' });

    expect(accountButton.tagName).toBe('BUTTON');
    accountButton.focus();
    fireEvent.click(accountButton);

    expect(accountButton.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(accountButton, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Account details' })).toBeNull();
    expect(document.activeElement).toBe(accountButton);

    fireEvent.click(accountButton);
    const accountDetails = screen.getByRole('region', { name: 'Account details' });
    fireEvent.click(within(accountDetails).getByRole('button', { name: 'Sign Out' }));

    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
