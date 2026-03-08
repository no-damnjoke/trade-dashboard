import { useState, useEffect, useRef } from 'preact/hooks';
import { useApp } from '../context/AppContext';
import type { PanelId } from '../types';
import './CommandPalette.css';

interface Command {
  label: string;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const { showPalette, closePalette, setFocusedPanel } = useApp();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { label: 'Focus Headlines', shortcut: '1', action: () => { setFocusedPanel('headlines'); closePalette(); } },
    { label: 'Focus Opportunity Board', shortcut: '2', action: () => { setFocusedPanel('watchlist'); closePalette(); } },
    { label: 'Focus Calendar', shortcut: '3', action: () => { setFocusedPanel('calendar'); closePalette(); } },
    { label: 'Focus Macro Shocks', shortcut: '4', action: () => { setFocusedPanel('velocity'); closePalette(); } },
    { label: 'Focus G10 FX Setups', shortcut: '5', action: () => { setFocusedPanel('setups'); closePalette(); } },
    { label: 'Focus Whale Radar', shortcut: '6', action: () => { setFocusedPanel('predictions'); closePalette(); } },
    { label: 'Clear Focus', shortcut: 'Esc', action: () => { setFocusedPanel(null); closePalette(); } },
  ];

  const filtered = query
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  useEffect(() => {
    if (showPalette) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showPalette]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (showPalette) closePalette();
        else { /* toggle is handled in context */ }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [showPalette, closePalette]);

  if (!showPalette) return null;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closePalette();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      filtered[selectedIdx].action();
    }
  };

  return (
    <div class="palette__backdrop" onClick={closePalette}>
      <div class="palette" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          class="palette__input"
          type="text"
          placeholder="Type a command..."
          value={query}
          onInput={e => { setQuery((e.target as HTMLInputElement).value); setSelectedIdx(0); }}
          onKeyDown={handleKeyDown}
        />
        <div class="palette__list">
          {filtered.map((cmd, i) => (
            <button
              key={cmd.label}
              class={`palette__item ${i === selectedIdx ? 'palette__item--selected' : ''}`}
              onClick={cmd.action}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <span>{cmd.label}</span>
              {cmd.shortcut && <kbd class="palette__kbd">{cmd.shortcut}</kbd>}
            </button>
          ))}
          {filtered.length === 0 && (
            <div class="palette__empty">No matching commands</div>
          )}
        </div>
      </div>
    </div>
  );
}
