import type { ComponentChildren } from 'preact';
import { useApp } from '../context/AppContext';
import { useDashboardLayout } from '../context/DashboardLayoutContext';
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
  const dashboardLayout = useDashboardLayout();
  const isFocused = focusedPanel === id;
  const panelStyle = dashboardLayout?.getPanelStyle(id);

  return (
    <section
      class={`panel ${isFocused ? 'panel--focused' : ''} ${dashboardLayout?.isDesktop ? 'panel--customizable' : ''}`}
      data-panel-id={id}
      style={panelStyle || (gridArea ? { gridArea } : undefined)}
      onClick={() => setFocusedPanel(id)}
    >
      <div
        class={`panel__header ${dashboardLayout?.isDesktop ? 'panel__header--draggable' : ''}`}
        onPointerDown={(event) => dashboardLayout?.startDrag(id, event)}
      >
        <span class="panel__title">{title}</span>
        {badge != null && <span class="panel__badge">{badge}</span>}
        {dashboardLayout?.isDesktop && <span class="panel__drag-indicator">::</span>}
      </div>
      <div class="panel__body" data-panel-scroll={id}>
        {children}
      </div>
      {dashboardLayout?.isDesktop && (
        <button
          type="button"
          class="panel__resize-handle"
          aria-label={`Resize ${title}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            dashboardLayout.startResize(id, event);
          }}
        />
      )}
    </section>
  );
}
