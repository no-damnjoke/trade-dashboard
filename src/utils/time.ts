const HKT_TIME_ZONE = 'Asia/Hong_Kong';

export function formatUTC(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: HKT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date()) + ' HKT';
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const future = diff < 0;
  const seconds = Math.floor(Math.abs(diff) / 1000);

  if (seconds < 60) return future ? `in ${seconds}s` : `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return future ? `in ${minutes}m` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return future ? `in ${days}d` : `${days}d ago`;
}

export function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: HKT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

export function isRecent(timestamp: number, thresholdMs = 5 * 60 * 1000): boolean {
  return Date.now() - timestamp < thresholdMs;
}
