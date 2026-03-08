import type { ComponentChildren } from 'preact';
import { useApp } from '../context/AppContext';
import type { PanelId } from '../types';
import './Panel.css';

interface PanelProps {
  id: PanelId;
  title: string;
  badge?: number | string;
  gridArea?: string;
  children: ComponentChildren;
}

export function Panel({ id, title, badge, gridArea, children }: PanelProps) {
  const { focusedPanel, setFocusedPanel } = useApp();
  const isFocused = focusedPanel === id;

  return (
    <section
      class={`panel ${isFocused ? 'panel--focused' : ''}`}
      data-panel-id={id}
      style={gridArea ? { gridArea } : undefined}
      onClick={() => setFocusedPanel(id)}
    >
      <div class="panel__header">
        <span class="panel__title">{title}</span>
        {badge != null && <span class="panel__badge">{badge}</span>}
      </div>
      <div class="panel__body" data-panel-scroll={id}>
        {children}
      </div>
    </section>
  );
}
