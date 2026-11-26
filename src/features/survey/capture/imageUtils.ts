// Browser image helpers for the capture flow. Isolated so tests can mock canvas / image decoding (jsdom has neither).

import type { MarkupObject } from '@/types/surveyor';
import { FALLBACK_PALETTE, MARKUP_COLORS, drawObjects, type Palette } from './markup';

/** Reads the markup palette from `--markup-*` CSS custom properties (design tokens), with safe fallbacks. */
export function readPalette(root: HTMLElement | null): Palette {
  if (!root) return FALLBACK_PALETTE;
  const computed = getComputedStyle(root);
  const palette = { ...FALLBACK_PALETTE };
  for (const color of MARKUP_COLORS) {
    const value = computed.getPropertyValue(`--markup-${color}`).trim();
    if (value) palette[color] = value;
  }
  return palette;
}

/** Marked-up copies are capped so very large camera frames don't exhaust memory or quota. */
export const MAX_EXPORT_EDGE = 2048;

export interface LoadedImage {
  element: HTMLImageElement;
  width: number;
  height: number;
  dispose: () => void;
}

export function loadImage(blob: Blob): Promise<LoadedImage> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () =>
      resolve({
        element,
        width: element.naturalWidth,
        height: element.naturalHeight,
        dispose: () => URL.revokeObjectURL(url),
      });
    element.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The photo could not be opened.'));
    };
    element.src = url;
  });
}

export function fitSize(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The image could not be exported.'))),
      type,
      quality,
    );
  });
}

interface BurnInText {
  /** e.g. "28 Oct 2026 · 10:36 am · Alex Morgan" (bottom-left). */
  stamp: string;
  /** e.g. "B1 · unit.entryPhoto" (top-left); included in marked copies only. */
  tag?: string;
}

function burnLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, scale: number) {
  const fontSize = 14 * scale;
  ctx.save();
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  const padX = 10 * scale;
  const height = fontSize + 12 * scale;
  const width = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = 'rgba(26, 26, 36, 0.78)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 6 * scale);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x + padX, y + height / 2);
  ctx.restore();
}

/** Draws the (immutable) original plus markup and burned-in stamp/tag onto a fresh canvas. */
export async function renderMarkedBlob(
  image: LoadedImage,
  objects: MarkupObject[],
  palette: Palette,
  burn: BurnInText,
): Promise<Blob> {
  const { width, height } = fitSize(image.width, image.height, MAX_EXPORT_EDGE);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Drawing is not supported on this device.');
  ctx.drawImage(image.element, 0, 0, width, height);
  drawObjects(ctx, objects, width, height, palette);
  const scale = width / 800;
  burnLabel(ctx, burn.stamp, 16 * scale, height - 16 * scale - (14 * scale + 12 * scale), scale);
  if (burn.tag) burnLabel(ctx, burn.tag, 16 * scale, 16 * scale, scale);
  return canvasToBlob(canvas);
}
