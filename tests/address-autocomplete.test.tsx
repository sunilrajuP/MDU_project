import { configureStore } from '@reduxjs/toolkit';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { baseApi } from '@/api/baseApi';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';

const feature = {
  geometry: { type: 'Point', coordinates: [150.9277573, -33.9715161] },
  properties: {
    osm_id: 1, street: 'Green Hills Road', district: 'Holsworthy',
    state: 'New South Wales', postcode: '2173', countrycode: 'AU',
  },
};

function Form() {
  const [value, setValue] = useState('');
  const [selected, setSelected] = useState(false);
  return <AddressAutocomplete
    label="Site Address"
    value={value}
    selected={selected}
    onChange={(text) => { setValue(text); setSelected(false); }}
    onSelect={(suggestion) => { setValue(suggestion.full); setSelected(true); }}
  />;
}

let store: ReturnType<typeof makeStore>;
function makeStore() {
  return configureStore({
    reducer: { api: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  store = makeStore();
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ features: [feature] })));
});

afterEach(() => {
  cleanup();
  store.dispatch(baseApi.util.resetApiState());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderForm() {
  return render(<Provider store={store}><Form /></Provider>);
}

async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

describe('address search debounce', () => {
  it('waits 300 ms after the final keystroke and sends only the latest text', async () => {
    renderForm();
    const input = screen.getByLabelText('Site Address');
    fireEvent.change(input, { target: { value: 'Gr' } });
    await advance(500);
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'Green' } });
    await advance(200);
    fireEvent.change(input, { target: { value: 'Green Hills' } });
    await advance(299);
    expect(fetch).not.toHaveBeenCalled();
    await advance(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new URL(String(vi.mocked(fetch).mock.calls[0][0])).searchParams.get('q')).toBe('Green Hills');
    fireEvent.click(screen.getByRole('option', { name: /Green Hills Road/ }));
    await advance(500);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Complete address selected')).toBeTruthy();
  });

  it('cancels a scheduled search when cleared or unmounted', async () => {
    const view = renderForm();
    const input = screen.getByLabelText('Site Address');
    fireEvent.change(input, { target: { value: 'Green' } });
    await advance(100);
    fireEvent.change(input, { target: { value: '' } });
    await advance(300);
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'Green Hills' } });
    view.unmount();
    await advance(300);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('aborts an in-flight search and ignores its stale response', async () => {
    let resolve: (response: Response) => void = () => { throw new Error('Search has not started.'); };
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }));
    renderForm();
    const input = screen.getByLabelText('Site Address');
    fireEvent.change(input, { target: { value: 'Old address' } });
    await advance(300);
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    fireEvent.change(input, { target: { value: 'New address' } });
    expect(signal?.aborted).toBe(true);
    await act(async () => { resolve(Response.json({ features: [feature] })); });
    expect(screen.queryByRole('option')).toBeNull();
    await advance(300);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('option', { name: /Green Hills Road/ })).toBeTruthy();
  });

  it('surfaces search failures and still allows manual entry', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Network unavailable'));
    renderForm();
    fireEvent.change(screen.getByLabelText('Site Address'), { target: { value: 'Manual address' } });
    await advance(300);
    expect(screen.getByRole('alert').textContent).toContain('Address search failed');
    expect((screen.getByLabelText('Site Address') as HTMLInputElement).value).toBe('Manual address');
  });
});
