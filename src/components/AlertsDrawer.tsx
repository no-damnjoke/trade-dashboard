import { useApp } from '../context/AppContext';
import { formatRelativeTime } from '../utils/time';
import './AlertsDrawer.css';

export function AlertsDrawer() {
  const { alerts, showAlerts, closeAlerts, dismissAlert, clearAlerts } = useApp();

  if (!showAlerts) return null;

  return (
    <div class="alerts-drawer__backdrop" onClick={closeAlerts}>
      <div class="alerts-drawer" onClick={e => e.stopPropagation()}>
        <div class="alerts-drawer__header">
          <span>Alerts</span>
          <div class="alerts-drawer__actions">
            {alerts.length > 0 && (
              <button class="alerts-drawer__clear" onClick={clearAlerts}>Clear all</button>
            )}
            <button class="alerts-drawer__close" onClick={closeAlerts}>Close</button>
          </div>
        </div>
        <div class="alerts-drawer__list">
          {alerts.length === 0 ? (
            <div class="alerts-drawer__empty">No recent alerts</div>
          ) : (
            alerts.slice(0, 20).map(alert => (
              <div key={alert.id} class={`alerts-drawer__item alerts-drawer__item--${alert.severity}`}>
                <div class="alerts-drawer__item-header">
                  <span class="alerts-drawer__severity">{alert.severity}</span>
                  <div class="alerts-drawer__item-actions">
                    <span class="alerts-drawer__time mono">{formatRelativeTime(alert.timestamp)}</span>
                    <button
                      class="alerts-drawer__dismiss"
                      onClick={() => dismissAlert(alert.id)}
                      title="Dismiss"
                    >&times;</button>
                  </div>
                </div>
                <div class="alerts-drawer__message">{alert.message}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
