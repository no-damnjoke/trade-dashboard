/**
 * API Request Tracker
 *
 * Logs outbound API calls with timestamps, latency, and status so
 * rate-limit investigations have stable hourly and daily counts.
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

interface APIStatsBucket {
  hourStart: number;
  service: string;
  requests: number;
  successes: number;
  failures: number;
}

const MAX_LOG_ENTRIES = 500;
const RETENTION_HOURS = 48;
const log: APILogEntry[] = [];
const hourlyStats = new Map<string, APIStatsBucket>();

function getHourStart(timestamp = Date.now()) {
  const d = new Date(timestamp);
  d.setUTCMinutes(0, 0, 0);
  return d.getTime();
}

function getDayStart(timestamp = Date.now()) {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getHourKey(hourStart: number, service: string) {
  return `${hourStart}:${service}`;
}

function isSuccessStatus(status: APILogEntry['status']) {
  return typeof status === 'number' && status >= 200 && status < 300;
}

function pruneHourlyStats(now = Date.now()) {
  const cutoff = getHourStart(now - RETENTION_HOURS * 60 * 60 * 1000);
  for (const [key, stats] of hourlyStats.entries()) {
    if (stats.hourStart < cutoff) hourlyStats.delete(key);
  }
}

function accumulateStats(
  target: Record<string, { requests: number; successes: number; failures: number }>,
  service: string,
  stats: Pick<APIStatsBucket, 'requests' | 'successes' | 'failures'>,
) {
  target[service] = target[service]
    ? {
        requests: target[service].requests + stats.requests,
        successes: target[service].successes + stats.successes,
        failures: target[service].failures + stats.failures,
      }
    : {
        requests: stats.requests,
        successes: stats.successes,
        failures: stats.failures,
      };
}

function getWindowStats(windowStart: number) {
  const byService: Record<string, { requests: number; successes: number; failures: number }> = {};
  for (const stats of hourlyStats.values()) {
    if (stats.hourStart < windowStart) continue;
    accumulateStats(byService, stats.service, stats);
  }
  return byService;
}

function getTodayStats(now = Date.now()) {
  const byService: Record<string, { requests: number; successes: number; failures: number }> = {};
  const dayStart = getDayStart(now);

  for (const entry of log) {
    if (entry.timestamp < dayStart) continue;
    accumulateStats(byService, entry.service, {
      requests: 1,
      successes: isSuccessStatus(entry.status) ? 1 : 0,
      failures: isSuccessStatus(entry.status) ? 0 : 1,
    });
  }

  return byService;
}

function getTrackedTotals() {
  let totalRequests = 0;
  let totalSuccesses = 0;
  let totalFailures = 0;

  for (const stats of hourlyStats.values()) {
    totalRequests += stats.requests;
    totalSuccesses += stats.successes;
    totalFailures += stats.failures;
  }

  return { totalRequests, totalSuccesses, totalFailures };
}

function getTrackedRange() {
  if (log.length === 0) {
    return { startedAt: null, latestAt: null };
  }

  return {
    startedAt: log[log.length - 1]?.timestamp ?? null,
    latestAt: log[0]?.timestamp ?? null,
  };
}

export function trackRequest(entry: Omit<APILogEntry, 'timestamp'>): void {
  const full: APILogEntry = { ...entry, timestamp: Date.now() };
  log.unshift(full);
  if (log.length > MAX_LOG_ENTRIES) log.pop();

  const hourStart = getHourStart(full.timestamp);
  const key = getHourKey(hourStart, full.service);
  const stats = hourlyStats.get(key) || {
    hourStart,
    service: full.service,
    requests: 0,
    successes: 0,
    failures: 0,
  };

  stats.requests += 1;
  if (isSuccessStatus(full.status)) stats.successes += 1;
  else stats.failures += 1;

  hourlyStats.set(key, stats);
  pruneHourlyStats(full.timestamp);
}

export function getAPILog(limit = 50): APILogEntry[] {
  return log.slice(0, limit);
}

export function getAPIStats(): {
  totalRequests: number;
  totalSuccesses: number;
  totalFailures: number;
  last1h: Record<string, { requests: number; successes: number; failures: number }>;
  last24h: Record<string, { requests: number; successes: number; failures: number }>;
  today: Record<string, { requests: number; successes: number; failures: number }>;
  retentionHours: number;
  trackedRange: { startedAt: number | null; latestAt: number | null };
} {
  const now = Date.now();
  pruneHourlyStats(now);
  const totals = getTrackedTotals();

  return {
    totalRequests: totals.totalRequests,
    totalSuccesses: totals.totalSuccesses,
    totalFailures: totals.totalFailures,
    last1h: getWindowStats(getHourStart(now)),
    last24h: getWindowStats(now - 24 * 60 * 60 * 1000),
    today: getTodayStats(now),
    retentionHours: RETENTION_HOURS,
    trackedRange: getTrackedRange(),
  };
}
