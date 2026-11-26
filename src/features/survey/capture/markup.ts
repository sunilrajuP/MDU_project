// Pure markup engine: vector objects (normalised 0–1 coordinates) -> canvas drawing. No React, no DOM state,
// so it is unit-testable and the same code renders the live preview and the exported marked-up copy.

import type { LineStyle, MarkupColor, MarkupKind, MarkupObject } from '@/types/surveyor';

export const MARKUP_COLORS: MarkupColor[] = ['red', 'yellow', 'green', 'blue', 'white', 'purple'];

export const COLOR_LABEL: Record<MarkupColor, string> = {
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  white: 'White',
  purple: 'Purple',
};

/** Fallback hex values; the editor overrides them from CSS custom properties (design tokens). */
export const FALLBACK_PALETTE: Record<MarkupColor, string> = {
  red: '#ff767f',
  yellow: '#efc16b',
  green: '#57d69a',
  blue: '#7ab8ff',
  white: '#ffffff',
  purple: '#8a7fff',
};

export type Palette = Record<MarkupColor, string>;

/** Strokes are authored against this canvas width and scaled for other sizes. */
const BASE_WIDTH = 800;

const DASH: Record<LineStyle, number[]> = {
  solid: [],
  dashed: [10, 6],
  dotted: [2, 6],
  dashDot: [12, 5, 2, 5],
  phantom: [18, 4, 3, 4, 3, 4],
};

export type DrawTool = Extract<MarkupKind, 'line' | 'arrow' | 'rect' | 'shape' | 'dimension'>;
export const DRAW_TOOLS: DrawTool[] = ['line', 'arrow', 'rect', 'shape', 'dimension'];

/** Drags shorter than this (normalised) are treated as taps and ignored. */
export const MIN_DRAG = 0.01;

export function newObjectId(): string {
  return crypto.randomUUID();
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function dragLength(a: [number, number], b: [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function strokeLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  color: string,
  scale: number,
  anchor: 'center' | 'start',
) {
  const fontSize = 15 * scale;
  ctx.save();
  ctx.setLineDash([]);
  ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  const padX = 10 * scale;
  const padY = 7 * scale;
  const width = ctx.measureText(text).width + padX * 2;
  const height = fontSize + padY * 2;
  const x = anchor === 'center' ? cx - width / 2 : cx;
  const y = cy - height / 2;
  ctx.fillStyle = 'rgba(26, 26, 36, 0.82)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 6 * scale);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(text, x + padX, cy);
  ctx.restore();
}

export function drawObject(
  ctx: CanvasRenderingContext2D,
  object: MarkupObject,
  width: number,
  height: number,
  palette: Palette,
): void {
  const scale = width / BASE_WIDTH;
  const color = palette[object.style.color];
  const pts = object.points.map(([x, y]) => [x * width, y * height] as const);
  if (pts.length === 0) return;
  const [x1, y1] = pts[0];

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = object.style.widthPx * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(DASH[object.style.lineStyle].map((segment) => segment * scale));

  if (object.kind === 'text' || object.kind === 'callout') {
    drawLabel(ctx, object.text ?? '', x1, y1, color, scale, 'start');
    ctx.restore();
    return;
  }

  if (pts.length < 2) {
    ctx.restore();
    return;
  }
  const [x2, y2] = pts[1];

  switch (object.kind) {
    case 'line':
      strokeLine(ctx, x1, y1, x2, y2);
      break;
    case 'arrow': {
      strokeLine(ctx, x1, y1, x2, y2);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const head = 16 * scale;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
      break;
    }
    case 'rect':
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      break;
    case 'shape':
      ctx.beginPath();
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'dimension': {
      strokeLine(ctx, x1, y1, x2, y2);
      const angle = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
      const tick = 10 * scale;
      ctx.setLineDash([]);
      for (const [x, y] of [[x1, y1], [x2, y2]]) {
        strokeLine(ctx, x - tick * Math.cos(angle), y - tick * Math.sin(angle), x + tick * Math.cos(angle), y + tick * Math.sin(angle));
      }
      if (object.text) {
        drawLabel(ctx, object.text, (x1 + x2) / 2, (y1 + y2) / 2 + 28 * scale, color, scale, 'center');
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

export function drawObjects(
  ctx: CanvasRenderingContext2D,
  objects: MarkupObject[],
  width: number,
  height: number,
  palette: Palette,
): void {
  for (const object of objects) drawObject(ctx, object, width, height, palette);
}

// --- undo / redo --------------------------------------------------------------------------------

export interface MarkupHistory {
  past: MarkupObject[][];
  present: MarkupObject[];
  future: MarkupObject[][];
}

export const emptyHistory = (initial: MarkupObject[] = []): MarkupHistory => ({
  past: [],
  present: initial,
  future: [],
});

export function commitHistory(history: MarkupHistory, next: MarkupObject[]): MarkupHistory {
  return { past: [...history.past, history.present], present: next, future: [] };
}

export function undoHistory(history: MarkupHistory): MarkupHistory {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redoHistory(history: MarkupHistory): MarkupHistory {
  if (history.future.length === 0) return history;
  const [next, ...rest] = history.future;
  return { past: [...history.past, history.present], present: next, future: rest };
}
