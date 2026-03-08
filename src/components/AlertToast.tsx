import { useApp } from '../context/AppContext';
import { formatRelativeTime } from '../utils/time';
import './AlertToast.css';

export function AlertToast() {
  const { alerts } = useApp();
  // Show only the last 3 recent alerts (< 60s old)
  const recent = alerts.filter(a => Date.now() - a.timestamp < 60_000).slice(0, 3);

  if (recent.length === 0) return null;

  return (
    <div class="toast-container">
      {recent.map(alert => (
        <div key={alert.id} class={`toast toast--${alert.severity}`}>
          <div class="toast__header">
            <span class="toast__severity">{alert.severity.toUpperCase()}</span>
            <span class="toast__time mono">{formatRelativeTime(alert.timestamp)}</span>
          </div>
          <div class="toast__message">{alert.message}</div>
        </div>
      ))}
    </div>
  );
}
