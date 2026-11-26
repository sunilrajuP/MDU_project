import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/store';
import { getDb } from '@/data/db/getDb';
import { mediaRepo } from '@/data/repos/mediaRepo';
import { CaptureFlow } from '@/features/survey/capture/CaptureFlow';
import {
  commitHistory,
  dragLength,
  emptyHistory,
  redoHistory,
  undoHistory,
} from '@/features/survey/capture/markup';
import { handleMockRequest } from '@/mocks/surveyor/handlers';
import { resetMockDb } from '@/mocks/surveyor/db';
import type { MarkupObject, MediaAttachment, MediaContext } from '@/types/surveyor';

vi.mock('@/features/survey/capture/imageUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/survey/capture/imageUtils')>();
  return {
    ...actual,
    loadImage: vi.fn(async () => ({
      element: document.createElement('img'),
      width: 1200,
      height: 800,
      dispose: vi.fn(),
    })),
    renderMarkedBlob: vi.fn(async () => new Blob(['marked'], { type: 'image/jpeg' })),
  };
});

const context: MediaContext = { sectionKey: 'external', itemCode: 'ext.letterbox', tag: 'External · ext.letterbox' };

const arrow = (id: string): MarkupObject => ({
  id,
  kind: 'arrow',
  points: [[0.1, 0.1], [0.5, 0.5]],
  style: { color: 'red', widthPx: 4, lineStyle: 'solid' },
});

describe('markup history', () => {
  it('commits, undoes and redoes, clearing redo on a new commit', () => {
    let history = emptyHistory();
    history = commitHistory(history, [arrow('a')]);
    history = commitHistory(history, [arrow('a'), arrow('b')]);
    expect(history.present).toHaveLength(2);

    history = undoHistory(history);
    expect(history.present.map((o) => o.id)).toEqual(['a']);
    history = redoHistory(history);
    expect(history.present).toHaveLength(2);

    history = undoHistory(history);
    history = commitHistory(history, [arrow('c')]);
    expect(history.future).toHaveLength(0);
    expect(undoHistory(emptyHistory())).toEqual(emptyHistory());
  });

  it('measures drags in normalised space', () => {
    expect(dragLength([0, 0], [0.3, 0.4])).toBeCloseTo(0.5);
  });
});

describe('surveyor mock API', () => {
  beforeEach(resetMockDb);

  it('replays a section save with the same clientRequestId instead of applying it twice', async () => {
    const req = {
      method: 'PUT' as const,
      path: '/jobs/MDU-000004/runbook/sections/whs',
      body: { key: 'whs', clientRequestId: 'req-1', baseRev: 0, data: { answers: [] } },
    };
    const first = await handleMockRequest(req);
    const second = await handleMockRequest(req);
    expect(first).toEqual(second);
    expect('data' in first && (first.data as { rev: number }).rev).toBe(1);
  });

  it('returns 404 for unknown jobs and routes', async () => {
    expect(await handleMockRequest({ method: 'GET', path: '/jobs/NOPE' })).toMatchObject({ error: { status: 404 } });
    expect(await handleMockRequest({ method: 'GET', path: '/nothing' })).toMatchObject({ error: { status: 404 } });
  });
});

describe('CaptureFlow', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await getDb().media.clear();
  });

  function renderFlow(onComplete: (a: MediaAttachment) => void, onClose = vi.fn()) {
    render(
      <Provider store={store}>
        <CaptureFlow
          jobRef="MDU-000001"
          context={context}
          itemLabel="Letterbox bank photographed"
          kind="photo"
          onComplete={onComplete}
          onClose={onClose}
        />
      </Provider>,
    );
  }

  async function chooseFile() {
    const file = new File(['raw-pixels'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Choose photo file'), { target: { files: [file] } });
    await screen.findByRole('button', { name: 'Use Photo' });
    return file;
  }

  it('runs capture -> preview -> markup and keeps the original untouched when markup is saved', async () => {
    const onComplete = vi.fn();
    renderFlow(onComplete);

    expect(screen.getByRole('dialog', { name: 'Photo Capture' })).toBeTruthy();
    await chooseFile();

    fireEvent.click(screen.getByRole('button', { name: 'Use Photo' }));
    await screen.findByRole('dialog', { name: 'Photo Markup Editor' });

    const [stored] = await getDb().media.toArray();
    expect(stored.syncStatus === 'pending' || stored.syncStatus === 'synced').toBe(true);
    // fake-indexeddb cannot round-trip jsdom Blobs, so immutability is asserted at the write level:
    // the markup save may only touch markedBlob / markup / syncStatus, never originalBlob.
    const updateSpy = vi.spyOn(getDb().media, 'update');

    fireEvent.change(screen.getByLabelText('Markup note'), { target: { value: 'Seal gap' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save markup & Use Photo' }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const after = await mediaRepo.get(stored.id);
    const markupWrites = updateSpy.mock.calls.filter(([, changes]) => 'markedBlob' in (changes as object));
    expect(markupWrites).toHaveLength(1);
    expect(Object.keys(markupWrites[0][1] as object).sort()).toEqual(['markedBlob', 'markup', 'syncStatus']);
    expect(after?.originalBlob).toEqual(stored.originalBlob);
    expect(after?.markedBlob).toBeDefined();
    expect(after?.markup?.note).toBe('Seal gap');
    expect(onComplete.mock.calls[0][0]).toMatchObject({ id: stored.id, kind: 'photo' });
  });

  it('attaches the original with no markup when markup is cancelled', async () => {
    const onComplete = vi.fn();
    renderFlow(onComplete);
    await chooseFile();
    fireEvent.click(screen.getByRole('button', { name: 'Use Photo' }));
    await screen.findByRole('dialog', { name: 'Photo Markup Editor' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel markup', hidden: false }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete.mock.calls[0][0]).toMatchObject({ hasMarkup: false });
    expect(await getDb().media.count()).toBe(1);
  });

  it('retake returns to capture without persisting anything', async () => {
    renderFlow(vi.fn());
    await chooseFile();
    fireEvent.click(screen.getByRole('button', { name: 'Retake' }));
    expect(await screen.findByRole('dialog', { name: 'Photo Capture' })).toBeTruthy();
    expect(await getDb().media.count()).toBe(0);
  });

  it('closes on Escape from the capture step', () => {
    const onClose = vi.fn();
    renderFlow(vi.fn(), onClose);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
