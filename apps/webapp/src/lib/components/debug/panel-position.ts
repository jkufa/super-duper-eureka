import type { PanelPosition } from './types';

export interface PanelDimensions {
  width: number;
  height: number;
}

export interface ViewportDimensions {
  width: number;
  height: number;
}

export interface DragStart {
  pointer: PanelPosition;
  position: PanelPosition;
}

export function clampPanelPosition(
  next: PanelPosition,
  panel: PanelDimensions,
  viewport: ViewportDimensions,
  gutter: number,
): PanelPosition {
  const minX = gutter;
  const minY = gutter;
  // const minX = panel.width + gutter * 2 <= viewport.width ? gutter : 0;
  // const minY = panel.height + gutter * 2 <= viewport.height ? gutter : 0;
  const maxX = Math.max(minX, viewport.width - panel.width - gutter);
  const maxY = Math.max(minY, viewport.height - panel.height - gutter);

  return {
    x: Math.min(Math.max(minX, next.x), maxX),
    y: Math.min(Math.max(minY, next.y), maxY),
  };
}

export function nextDragPosition(start: DragStart, pointer: PanelPosition): PanelPosition {
  return {
    x: start.position.x + (pointer.x - start.pointer.x),
    y: start.position.y + (pointer.y - start.pointer.y),
  };
}

export function parseStoredPosition(raw: string | null, fallback: PanelPosition): PanelPosition {
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as PanelPosition;
    if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
      return parsed;
    }
    return fallback;
  }
  catch {
    return fallback;
  }
}
