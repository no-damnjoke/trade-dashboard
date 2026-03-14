import { useEffect } from 'preact/hooks';
import { useApp } from '../context/AppContext';
import type { PanelId } from '../types';

const PANEL_ORDER: PanelId[] = ['headlines', 'watchlist', 'calendar', 'velocity', 'setups', 'predictions'];

export function useKeyboardNavigation() {
  const { focusedPanel, setFocusedPanel, togglePalette, toggleHelp } = useApp();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't intercept when typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;

      // Ctrl/Cmd+K — command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        togglePalette();
        return;
      }

      // Number keys 1-7 — direct panel focus
      if (e.key >= '1' && e.key <= '7') {
        const idx = parseInt(e.key) - 1;
        if (PANEL_ORDER[idx]) {
          e.preventDefault();
          setFocusedPanel(PANEL_ORDER[idx]);
        }
        return;
      }

      // Tab — cycle panels
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const currentIdx = focusedPanel ? PANEL_ORDER.indexOf(focusedPanel) : -1;
        const nextIdx = e.shiftKey
          ? (currentIdx <= 0 ? PANEL_ORDER.length - 1 : currentIdx - 1)
          : (currentIdx + 1) % PANEL_ORDER.length;
        setFocusedPanel(PANEL_ORDER[nextIdx]);
        return;
      }

      // j/k — scroll focused panel
      if ((e.key === 'j' || e.key === 'k') && focusedPanel) {
        const scrollEl = document.querySelector(`[data-panel-scroll="${focusedPanel}"]`);
        if (scrollEl) {
          e.preventDefault();
          scrollEl.scrollBy({ top: e.key === 'j' ? 80 : -80, behavior: 'smooth' });
        }
        return;
      }

      // Escape — clear focus
      if (e.key === 'Escape') {
        setFocusedPanel(null);
        return;
      }

      // ? — help
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleHelp();
        return;
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [focusedPanel, setFocusedPanel, togglePalette, toggleHelp]);
}
