import { useApp } from '../context/AppContext';
import './HelpOverlay.css';

const shortcuts = [
  ['1 – 7', 'Focus panel'],
  ['Tab / Shift+Tab', 'Cycle panels'],
  ['j / k', 'Scroll focused panel'],
  ['Ctrl+K', 'Command palette'],
  ['Esc', 'Close / clear focus'],
  ['?', 'This help'],
];

export function HelpOverlay() {
  const { showHelp, toggleHelp } = useApp();

  if (!showHelp) return null;

  return (
    <div class="help__backdrop" onClick={toggleHelp}>
      <div class="help" onClick={e => e.stopPropagation()}>
        <div class="help__title">Keyboard Shortcuts</div>
        <div class="help__list">
          {shortcuts.map(([key, desc]) => (
            <div key={key} class="help__row">
              <kbd class="help__key">{key}</kbd>
              <span class="help__desc">{desc}</span>
            </div>
          ))}
        </div>
        <button class="help__close" onClick={toggleHelp}>Close</button>
      </div>
    </div>
  );
}
