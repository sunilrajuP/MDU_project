import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/api/baseApi';
import authReducer from '@/features/auth/authSlice';
import { LoginPage } from '@/features/auth/LoginPage';
import jobsReducer from '@/features/jobs/jobsSlice';
import teamReducer from '@/features/teamlead/teamSlice';

function renderLogin() {
  const store = configureStore({
    reducer: { auth: authReducer, jobs: jobsReducer, team: teamReducer, api: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
  render(<Provider store={store}><MemoryRouter><LoginPage /></MemoryRouter></Provider>);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('login errors', () => {
  it.each([
    [401, { error: 'Password is incorrect.' }, 'Password is incorrect.'],
    [400, { errorMessage: 'Account is locked.' }, 'Account is locked.'],
    [403, { title: 'Forbidden', message: 'Your access is suspended.' }, 'Your access is suspended.'],
    [500, { detail: 'Authentication is temporarily unavailable.' }, 'Authentication is temporarily unavailable.'],
    [400, { title: 'Validation failed', errors: { email: ['Email is required.'], password: ['Password is required.'] } }, 'Email is required. Password is required.'],
    [400, 'Please reset your password.', 'Please reset your password.'],
    [401, {}, 'Invalid email or password.'],
  ])('shows the response message for HTTP %i', async (status, body, expected) => {
    vi.stubGlobal('fetch', vi.fn(async () => typeof body === 'string'
      ? new Response(body, { status })
      : Response.json(body, { status })));
    renderLogin();
    expect((await screen.findByRole('alert')).textContent).toBe(expected);
  });

  it('shows a connection error when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network unavailable')));
    renderLogin();
    expect((await screen.findByRole('alert')).textContent).toBe('Unable to reach the server. Check your connection.');
  });
});
