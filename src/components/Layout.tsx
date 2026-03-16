import { useEffect } from 'preact/hooks';
import { Header } from './Header';
import { Heatmap } from './Heatmap';
import { StatusBar } from './StatusBar';
import { HeadlinesPanel } from '../panels/HeadlinesPanel';
import { WatchlistPanel } from '../panels/WatchlistPanel';
import { CalendarPanel } from '../panels/CalendarPanel';
import { PredictionPanel } from '../panels/PredictionPanel';
import { VelocityPanel } from '../panels/VelocityPanel';
import { SetupsPanel } from '../panels/SetupsPanel';

import { CommandPalette } from './CommandPalette';
import { HelpOverlay } from './HelpOverlay';
import { AlertsDrawer } from './AlertsDrawer';
import { usePolling } from '../hooks/usePolling';
import { fetchJSON } from '../services/api';
import { useApp } from '../context/AppContext';
import { DashboardLayoutProvider, useDashboardLayout } from '../context/DashboardLayoutContext';
import type { Alert } from '../types';
import './Layout.css';

interface AlertsResponse {
  alerts: Alert[];
}

function LayoutFrame() {
  const { setAlerts } = useApp();
  const dashboardLayout = useDashboardLayout();
  const { data } = usePolling<AlertsResponse>(() => fetchJSON('/alerts'), 5_000);

  useEffect(() => {
    if (data?.alerts) {
      setAlerts(data.alerts);
    }
  }, [data, setAlerts]);

  return (
    <div class="layout">
      <Header />
      <Heatmap />
      <main
        ref={dashboardLayout?.containerRef}
        class={`layout__grid ${dashboardLayout?.isDesktop ? 'layout__grid--desktop' : ''}`}
      >
        <HeadlinesPanel />
        <VelocityPanel />
        <SetupsPanel />
        <PredictionPanel />
        <WatchlistPanel />
        <CalendarPanel />
      </main>
      <StatusBar />
      <CommandPalette />
      <HelpOverlay />
      <AlertsDrawer />
    </div>
  );
}

export function Layout() {
  return (
    <DashboardLayoutProvider>
      <LayoutFrame />
    </DashboardLayoutProvider>
  );
}
