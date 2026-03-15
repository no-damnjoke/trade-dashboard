/**
 * API Request Tracker
 *
 * Logs all outbound API calls (AI proxy, Brave Search, RSS feeds)
 * with timestamps, latency, and status for rate limit investigation.
 */

interface APILogEntry {
  timestamp: number;
  service: string;
  endpoint: string;
  method: string;
  status: number | 'timeout' | 'error';
  latencyMs: number;
  detail?: string;
}

const MAX_LOG_ENTRIES = 500;
const log: APILogEntry[] = [];

const hourlyStats = new Map<string, { requests: number; successes: number; failures: number }>();

function getHourKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}`;
}

export function trackRequest(entry: Omit<APILogEntry, 'timestamp'>): void {
  const full: APILogEntry = { ...entry, timestamp: Date.now() };
  log.unshift(full);
  if (log.length > MAX_LOG_ENTRIES) log.pop();

  const hourKey = `${getHourKey()}:${entry.service}`;
  const stats = hourlyStats.get(hourKey) || { requests: 0, successes: 0, failures: 0 };
  stats.requests += 1;
  if (typeof entry.status === 'number' && entry.status >= 200 && entry.status < 300) {
    stats.successes += 1;
  } else {
    stats.failures += 1;
  }
  hourlyStats.set(hourKey, stats);

  // Prune hourly stats older than 48 hours
  const cutoff = new Date();
  cutoff.setUTCHours(cutoff.getUTCHours() - 48);
  const cutoffKey = `${cutoff.getUTCFullYear()}-${String(cutoff.getUTCMonth() + 1).padStart(2, '0')}-${String(cutoff.getUTCDate()).padStart(2, '0')}T${String(cutoff.getUTCHours()).padStart(2, '0')}`;
  for (const key of hourlyStats.keys()) {
    if (key < cutoffKey) hourlyStats.delete(key);
  }
}

export function getAPILog(limit = 50): APILogEntry[] {
  return log.slice(0, limit);
}

export function getAPIStats(): {
  totalRequests: number;
  last1h: Record<string, { requests: number; successes: number; failures: number }>;
  last24h: Record<string, { requests: number; successes: number; failures: number }>;
} {
  const currentHour = getHourKey();
  const last1h: Record<string, { requests: number; successes: number; failures: number }> = {};
  const last24h: Record<string, { requests: number; successes: number; failures: number }> = {};

  for (const [key, stats] of hourlyStats.entries()) {
    const [hour, service] = key.split(':');
    if (hour === currentHour) {
      last1h[service] = last1h[service]
        ? { requests: last1h[service].requests + stats.requests, successes: last1h[service].successes + stats.successes, failures: last1h[service].failures + stats.failures }
        : { ...stats };
    }
    last24h[service] = last24h[service]
      ? { requests: last24h[service].requests + stats.requests, successes: last24h[service].successes + stats.successes, failures: last24h[service].failures + stats.failures }
      : { ...stats };
  }

  return {
    totalRequests: log.length,
    last1h,
    last24h,
  };
}
