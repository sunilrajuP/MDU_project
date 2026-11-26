import { useEffect, useReducer, useRef, useState, type PointerEvent } from 'react';
import {
  Minus,
  MoveUpRight,
  Palette as PaletteIcon,
  Redo2,
  Ruler,
  Shapes,
  Square,
  Trash2,
  Type,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Input } from '@/components/ui/Input';
import type { MarkupColor, MarkupObject } from '@/types/surveyor';
import { fitSize, readPalette, type LoadedImage } from './imageUtils';
import {
  COLOR_LABEL,
  MARKUP_COLORS,
  MIN_DRAG,
  clamp01,
  commitHistory,
  dragLength,
  drawObject,
  drawObjects,
  emptyHistory,
  newObjectId,
  redoHistory,
  undoHistory,
  type DrawTool,
  type MarkupHistory,
  type Palette,
} from './markup';
import styles from './MarkupEditor.module.scss';

type Tool = DrawTool | 'text';
type HistoryAction =
  | { type: 'commit'; objects: MarkupObject[] }
  | { type: 'undo' }
  | { type: 'redo' };

function historyReducer(state: MarkupHistory, action: HistoryAction): MarkupHistory {
  switch (action.type) {
    case 'commit':
      return commitHistory(state, action.objects);
    case 'undo':
      return undoHistory(state);
    case 'redo':
      return redoHistory(state);
  }
}

const TOOLS: { tool: Tool; label: string; icon: LucideIcon }[] = [
  { tool: 'line', label: 'Line', icon: Minus },
  { tool: 'arrow', label: 'Arrow', icon: MoveUpRight },
  { tool: 'rect', label: 'Rectangle', icon: Square },
  { tool: 'shape', label: 'Shape', icon: Shapes },
  { tool: 'dimension', label: 'Dimension', icon: Ruler },
];

const STROKE_PX = 4;
/** Longest edge of the on-screen canvas backing store. */
const PREVIEW_EDGE = 1600;

interface PendingLabel {
  kind: 'text' | 'dimension';
  object: MarkupObject;
}

export interface MarkupResult {
  objects: MarkupObject[];
  note: string;
  palette: Palette;
}

interface MarkupEditorProps {
  image: LoadedImage;
  initialObjects?: MarkupObject[];
  initialNote?: string;
  stamp: string;
  saving: boolean;
  error?: string;
  onSave: (result: MarkupResult) => void;
  onCancel: () => void;
}

export function MarkupEditor({
  image,
  initialObjects = [],
  initialNote = '',
  stamp,
  saving,
  error,
  onSave,
  onCancel,
}: Readonly<MarkupEditorProps>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [history, dispatch] = useReducer(historyReducer, initialObjects, emptyHistory);
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState<MarkupColor>('red');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drag, setDrag] = useState<{ start: [number, number]; end: [number, number] } | null>(null);
  const [pending, setPending] = useState<PendingLabel | null>(null);
  const [labelText, setLabelText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState(initialNote);

  const canvasSize = fitSize(image.width, image.height, PREVIEW_EDGE);
  const objects = history.present;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const palette = readPalette(rootRef.current);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image.element, 0, 0, canvas.width, canvas.height);
    drawObjects(ctx, objects, canvas.width, canvas.height, palette);
    if (pending) drawObject(ctx, pending.object, canvas.width, canvas.height, palette);
    if (drag && tool !== 'text') {
      drawObject(
        ctx,
        { id: 'draft', kind: tool, points: [drag.start, drag.end], style: { color, widthPx: STROKE_PX, lineStyle: 'solid' } },
        canvas.width,
        canvas.height,
        palette,
      );
    }
  }, [image, canvasSize.width, canvasSize.height, objects, drag, pending, tool, color]);

  function pointFromEvent(event: PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = event.currentTarget.getBoundingClientRect();
    return [clamp01((event.clientX - rect.left) / rect.width), clamp01((event.clientY - rect.top) / rect.height)];
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (pending || saving) return;
    const point = pointFromEvent(event);
    if (tool === 'text') {
      setPending({
        kind: 'text',
        object: { id: newObjectId(), kind: 'text', points: [point], style: { color, widthPx: STROKE_PX, lineStyle: 'solid' } },
      });
      setLabelText('');
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ start: point, end: point });
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag) return;
    const end = pointFromEvent(event);
    setDrag((current) => (current ? { ...current, end } : current));
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag || tool === 'text') return;
    const end = pointFromEvent(event);
    const finished = drag;
    setDrag(null);
    if (dragLength(finished.start, end) < MIN_DRAG) return;
    const object: MarkupObject = {
      id: newObjectId(),
      kind: tool,
      points: [finished.start, end],
      style: { color, widthPx: STROKE_PX, lineStyle: 'solid' },
    };
    if (tool === 'dimension') {
      setPending({ kind: 'dimension', object });
      setLabelText('');
      return;
    }
    dispatch({ type: 'commit', objects: [...objects, object] });
    setSelectedId(object.id);
  }

  function commitPending(withLabel: boolean) {
    if (!pending) return;
    const text = labelText.trim();
    setPending(null);
    setLabelText('');
    if (pending.kind === 'text' && !text) return;
    const object = { ...pending.object, text: withLabel && text ? text : undefined };
    dispatch({ type: 'commit', objects: [...objects, object] });
    setSelectedId(object.id);
  }

  function deleteSelected() {
    if (objects.length === 0) return;
    const targetId = objects.some((entry) => entry.id === selectedId) ? selectedId : objects.at(-1)?.id;
    dispatch({ type: 'commit', objects: objects.filter((entry) => entry.id !== targetId) });
    setSelectedId(null);
  }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      style={{ ['--markup-ratio' as string]: `${canvasSize.width} / ${canvasSize.height}` }}
    >
      <Callout tone="info">Original photo is always kept</Callout>

      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          role="img"
          aria-label="Photo markup canvas. Draw with the selected tool."
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setDrag(null)}
        />
        <span className={styles.previewTag}>MARKUP PREVIEW · ORIGINAL PRESERVED</span>
        <span className={styles.stamp}>{stamp}</span>
        <span className={styles.colorDot} data-color={color} aria-hidden="true" />
      </div>

      <div className={styles.toolbar} role="toolbar" aria-label="Markup tools">
        {TOOLS.map(({ tool: value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            className={[styles.tool, tool === value ? styles.toolActive : ''].filter(Boolean).join(' ')}
            aria-pressed={tool === value}
            onClick={() => setTool(value)}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
        <button
          type="button"
          className={[styles.tool, paletteOpen ? styles.toolActive : ''].filter(Boolean).join(' ')}
          aria-pressed={paletteOpen}
          aria-expanded={paletteOpen}
          onClick={() => setPaletteOpen((open) => !open)}
        >
          <PaletteIcon size={20} aria-hidden="true" />
          <span>Color</span>
        </button>
        <button
          type="button"
          className={[styles.tool, tool === 'text' ? styles.toolActive : ''].filter(Boolean).join(' ')}
          aria-pressed={tool === 'text'}
          onClick={() => setTool('text')}
        >
          <Type size={20} aria-hidden="true" />
          <span>Text</span>
        </button>
      </div>

      {paletteOpen && (
        <div className={styles.palette} role="radiogroup" aria-label="Markup colour">
          {MARKUP_COLORS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={color === value}
              aria-label={COLOR_LABEL[value]}
              data-color={value}
              className={[styles.swatch, color === value ? styles.swatchActive : ''].filter(Boolean).join(' ')}
              onClick={() => {
                setColor(value);
                setPaletteOpen(false);
              }}
            />
          ))}
        </div>
      )}

      {pending && (
        <form
          className={styles.labelForm}
          onSubmit={(event) => {
            event.preventDefault();
            commitPending(true);
          }}
        >
          <Input
            label={pending.kind === 'dimension' ? 'Dimension label (optional)' : 'Text label'}
            value={labelText}
            onChange={(event) => setLabelText(event.target.value)}
            autoFocus
          />
          <Button type="submit" variant="secondary">
            Add
          </Button>
          <Button type="button" variant="ghost" onClick={() => commitPending(false)}>
            {pending.kind === 'dimension' ? 'Skip label' : 'Cancel'}
          </Button>
        </form>
      )}

      <div className={styles.statusRow}>
        <span className={styles.status}>
          <span className={styles.statusDot} data-color={color} aria-hidden="true" />
          {COLOR_LABEL[color]} · {STROKE_PX} px
        </span>
        <div className={styles.history}>
          <button type="button" className={styles.iconButton} onClick={() => dispatch({ type: 'undo' })} disabled={history.past.length === 0} aria-label="Undo">
            <Undo2 size={20} aria-hidden="true" />
          </button>
          <button type="button" className={styles.iconButton} onClick={() => dispatch({ type: 'redo' })} disabled={history.future.length === 0} aria-label="Redo">
            <Redo2 size={20} aria-hidden="true" />
          </button>
          <button type="button" className={styles.iconButton} onClick={deleteSelected} disabled={objects.length === 0} aria-label="Delete selected markup">
            <Trash2 size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <Input label="Markup note" value={note} onChange={(event) => setNote(event.target.value)} />
      <p className={styles.help}>
        Original and marked-up versions will remain separate evidence files. Draft has not been added to the survey.
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <footer className={styles.footer}>
        <Button type="button" disabled={saving} onClick={() => onSave({ objects, note, palette: readPalette(rootRef.current) })}>
          {saving ? 'Saving…' : 'Save markup & Use Photo'}
        </Button>
        <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
          Cancel markup
        </Button>
      </footer>
    </div>
  );
}
