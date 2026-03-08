export interface Alert {
  id: string;
  type: 'price_shock' | 'volume_spike' | 'headline';
  category: string;
  source: string;
  message: string;
  severity: 'critical' | 'high' | 'medium';
  timestamp: number;
  pair?: string;
  change?: number;
  assetIds?: string[];
  reason?: string;
  suppressed?: boolean;
}

const alerts: Alert[] = [];
const MAX_ALERTS = 50;

export function addAlert(alert: Omit<Alert, 'id' | 'timestamp'>) {
  alerts.unshift({
    ...alert,
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  });
  if (alerts.length > MAX_ALERTS) alerts.length = MAX_ALERTS;
}

export function getAlerts(): Alert[] {
  return alerts;
}

export function clearAlerts(): void {
  alerts.length = 0;
}
