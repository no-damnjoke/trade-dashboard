import { createContext } from 'preact';
import { useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { PanelId } from '../types';

interface PanelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type PanelLayout = Record<PanelId, PanelRect>;

interface DashboardLayoutContextValue {
  containerRef: { current: HTMLDivElement | null };
  isDesktop: boolean;
  getPanelStyle: (id: PanelId) => Record<string, string> | undefined;
  startDrag: (id: PanelId, event: PointerEvent) => void;
  startResize: (id: PanelId, event: PointerEvent) => void;
  resetLayout: () => void;
}

const STORAGE_KEY = 'market-monitor.dashboard-layout.v1';
const GRID_COLUMNS = 12;
const GRID_ROWS = 12;
const MIN_WIDTH = 3;
const MIN_HEIGHT = 2;

const DEFAULT_LAYOUT: PanelLayout = {
  headlines: { x: 1, y: 1, w: 4, h: 3 },
  velocity: { x: 1, y: 4, w: 4, h: 3 },
  setups: { x: 1, y: 7, w: 4, h: 3 },
  predictions: { x: 1, y: 10, w: 4, h: 3 },
  watchlist: { x: 5, y: 1, w: 8, h: 8 },
  calendar: { x: 5, y: 9, w: 8, h: 4 },
};

const PANEL_ORDER: PanelId[] = ['headlines', 'watchlist', 'calendar', 'velocity', 'setups', 'predictions'];

const DashboardLayoutContext = createContext<DashboardLayoutContextValue | null>(null);

function clampRect(rect: PanelRect): PanelRect {
  const w = Math.max(MIN_WIDTH, Math.min(GRID_COLUMNS, rect.w));
  const h = Math.max(MIN_HEIGHT, Math.min(GRID_ROWS, rect.h));
  const x = Math.max(1, Math.min(GRID_COLUMNS - w + 1, rect.x));
  const y = Math.max(1, Math.min(GRID_ROWS - h + 1, rect.y));
  return { x, y, w, h };
}

function overlaps(a: PanelRect, b: PanelRect) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function tryPlaceRect(preferred: PanelRect, placed: PanelRect[]): PanelRect {
  const rect = clampRect(preferred);
  const maxX = GRID_COLUMNS - rect.w + 1;
  const maxY = GRID_ROWS - rect.h + 1;

  for (let y = rect.y; y <= maxY; y++) {
    const candidate = { ...rect, y };
    if (!placed.some(item => overlaps(candidate, item))) return candidate;
  }

  for (let y = 1; y <= maxY; y++) {
    for (let x = 1; x <= maxX; x++) {
      const candidate = { ...rect, x, y };
      if (!placed.some(item => overlaps(candidate, item))) return candidate;
    }
  }

  return rect;
}

function normalizeLayout(nextLayout: PanelLayout, activeId: PanelId): PanelLayout {
  const placed: Partial<PanelLayout> = {};
  const occupied: PanelRect[] = [];
  const orderedIds: PanelId[] = [activeId, ...PANEL_ORDER.filter(id => id !== activeId)];

  for (const id of orderedIds) {
    const rect = tryPlaceRect(nextLayout[id], occupied);
    placed[id] = rect;
    occupied.push(rect);
  }

  return placed as PanelLayout;
}

function isPanelLayout(value: unknown): value is PanelLayout {
  if (!value || typeof value !== 'object') return false;
  return PANEL_ORDER.every(id => {
    const rect = (value as Record<string, unknown>)[id] as Record<string, unknown> | undefined;
    return !!rect &&
      typeof rect.x === 'number' &&
      typeof rect.y === 'number' &&
      typeof rect.w === 'number' &&
      typeof rect.h === 'number';
  });
}

export function DashboardLayoutProvider({ children }: { children: ComponentChildren }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<PanelLayout>(DEFAULT_LAYOUT);
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window === 'undefined' ? true : window.innerWidth > 1024
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as unknown;
      if (isPanelLayout(parsed)) {
        setLayout(normalizeLayout(parsed, 'watchlist'));
      }
    } catch {
      // Ignore corrupted saved layout and fall back to defaults.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onResize = () => setIsDesktop(window.innerWidth > 1024);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const updateLayout = (panelId: PanelId, nextRect: PanelRect) => {
    setLayout(prev => normalizeLayout({
      ...prev,
      [panelId]: clampRect(nextRect),
    }, panelId));
  };

  const startInteraction = (panelId: PanelId, event: PointerEvent, mode: 'drag' | 'resize') => {
    if (!isDesktop || !containerRef.current) return;

    event.preventDefault();
    const container = containerRef.current;
    const startRect = layout[panelId];
    const bounds = container.getBoundingClientRect();
    const cellWidth = bounds.width / GRID_COLUMNS;
    const cellHeight = bounds.height / GRID_ROWS;
    const startX = event.clientX;
    const startY = event.clientY;

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const deltaX = Math.round((moveEvent.clientX - startX) / Math.max(cellWidth, 1));
      const deltaY = Math.round((moveEvent.clientY - startY) / Math.max(cellHeight, 1));

      if (mode === 'drag') {
        updateLayout(panelId, {
          ...startRect,
          x: startRect.x + deltaX,
          y: startRect.y + deltaY,
        });
        return;
      }

      updateLayout(panelId, {
        ...startRect,
        w: startRect.w + deltaX,
        h: startRect.h + deltaY,
      });
    };

    const onEnd = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
  };

  const value = useMemo<DashboardLayoutContextValue>(() => ({
    containerRef,
    isDesktop,
    getPanelStyle: (id: PanelId) => (
      isDesktop
        ? {
            gridColumn: `${layout[id].x} / span ${layout[id].w}`,
            gridRow: `${layout[id].y} / span ${layout[id].h}`,
          }
        : undefined
    ),
    startDrag: (id, event) => startInteraction(id, event, 'drag'),
    startResize: (id, event) => startInteraction(id, event, 'resize'),
    resetLayout: () => setLayout(DEFAULT_LAYOUT),
  }), [isDesktop, layout]);

  return (
    <DashboardLayoutContext.Provider value={value}>
      {children}
    </DashboardLayoutContext.Provider>
  );
}

export function useDashboardLayout() {
  return useContext(DashboardLayoutContext);
}
