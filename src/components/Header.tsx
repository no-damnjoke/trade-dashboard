import { useState, useEffect } from 'preact/hooks';
import { useApp } from '../context/AppContext';
import { useDashboardLayout } from '../context/DashboardLayoutContext';
import { formatUTC } from '../utils/time';
import './Header.css';

export function Header() {
  const { alerts, toggleAlerts, togglePalette, toggleHelp } = useApp();
  const dashboardLayout = useDashboardLayout();
  const [clock, setClock] = useState(formatUTC());
  const unreadAlerts = alerts.filter(a => Date.now() - a.timestamp < 300_000).length;

  useEffect(() => {
    const timer = setInterval(() => setClock(formatUTC()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header class="header">
      <div class="header__left">
        <span class="header__logo">MARKET MONITOR</span>
        <span class="header__live">
          <span class="header__dot" /> LIVE
        </span>
      </div>
      <div class="header__right">
        {dashboardLayout?.isDesktop && (
          <button
            class="header__btn header__btn--wide"
            onClick={dashboardLayout.resetLayout}
            title="Reset panel layout"
          >
            Reset Layout
          </button>
        )}
        <button
          class="header__btn header__alert-btn"
          onClick={toggleAlerts}
          title="Alerts"
        >
          {unreadAlerts > 0 && <span class="header__alert-count">{unreadAlerts}</span>}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
        <span class="header__clock mono">{clock}</span>
        <button class="header__btn" onClick={togglePalette} title="Command Palette (Ctrl+K)">
          <kbd>K</kbd>
        </button>
        <button class="header__btn" onClick={toggleHelp} title="Keyboard Shortcuts (?)">?</button>
      </div>
    </header>
  );
}
