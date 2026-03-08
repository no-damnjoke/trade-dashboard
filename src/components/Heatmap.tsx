import { usePolling } from '../hooks/usePolling';
import { fetchJSON } from '../services/api';
import { formatPercent } from '../utils/format';
import type { HeatmapEntry } from '../types';
import './Heatmap.css';

interface HeatmapResponse {
  currencies: HeatmapEntry[];
  lastUpdated: number;
}

function getHeatColor(pct: number): string {
  const clamped = Math.max(-1.5, Math.min(1.5, pct));
  const intensity = Math.abs(clamped) / 1.5;

  if (clamped > 0) {
    const r = Math.round(17 + (34 - 17) * (1 - intensity));
    const g = Math.round(24 + (197 - 24) * intensity);
    const b = Math.round(28 + (94 - 28) * intensity);
    return `rgb(${r},${g},${b})`;
  } else if (clamped < 0) {
    const r = Math.round(31 + (239 - 31) * intensity);
    const g = Math.round(31 + (68 - 31) * (1 - intensity));
    const b = Math.round(44 + (68 - 44) * (1 - intensity));
    return `rgb(${r},${g},${b})`;
  }
  return 'var(--heat-neutral)';
}

export function Heatmap() {
  const { data } = usePolling<HeatmapResponse>(
    () => fetchJSON('/heatmap'),
    30_000,
  );

  const currencies = data?.currencies ?? [];

  return (
    <div class="heatmap">
      <span class="heatmap__label">G10 vs USD</span>
      <div class="heatmap__cells">
        {currencies.length === 0
          ? ['EUR','GBP','JPY','CHF','AUD','CAD','NZD','SEK','NOK'].map(c => (
              <div key={c} class="heatmap__cell" style={{ background: 'var(--bg-elevated)' }}>
                <span class="heatmap__ccy">{c}</span>
                <span class="heatmap__pct mono">—</span>
              </div>
            ))
          : currencies.map(c => (
              <div
                key={c.currency}
                class="heatmap__cell"
                style={{ background: getHeatColor(c.changePercent) }}
              >
                <span class="heatmap__ccy">{c.currency}</span>
                <span class="heatmap__pct mono">{formatPercent(c.changePercent)}</span>
              </div>
            ))
        }
      </div>
    </div>
  );
}
