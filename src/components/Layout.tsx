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
import type { Alert } from '../types';
import './Layout.css';

interface AlertsResponse {
  alerts: Alert[];
}

export function Layout() {
  const { setAlerts } = useApp();
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
      <main class="layout__grid">
        <div class="layout__left">
          <HeadlinesPanel />
          <VelocityPanel />
          <SetupsPanel />
          <PredictionPanel />
        </div>
        <div class="layout__right">
          <WatchlistPanel />
          <CalendarPanel />
        </div>
      </main>
      <StatusBar />
      <CommandPalette />
      <HelpOverlay />
      <AlertsDrawer />
    </div>
  );
}
