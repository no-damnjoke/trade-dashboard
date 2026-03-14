import { formatVolume } from '../utils/format';
import type { PredictionMarket } from '../types';
import './PredictionRow.css';

function formatDelta(delta: number | null): string {
  if (delta == null) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}pp`;
}

function deltaClass(delta: number | null): string {
  if (delta == null || Math.abs(delta) < 0.5) return '';
  if (Math.abs(delta) >= 5) return delta > 0 ? 'pred-row__delta--big-up' : 'pred-row__delta--big-down';
  return delta > 0 ? 'pred-row__delta--up' : 'pred-row__delta--down';
}

export function PredictionRow({ market }: { market: PredictionMarket }) {
  const yesPct = market.yesPct;
  const bigShift = Math.abs(market.delta24h ?? 0) >= 5;

  return (
    <div class={`pred-row ${bigShift ? 'pred-row--shift' : market.volumeSpike ? 'pred-row--hot' : ''}`}>
      <div class="pred-row__question">{market.question}</div>
      <div class="pred-row__bar-wrap">
        <div class="pred-row__bar">
          <div
            class="pred-row__bar-fill"
            style={{ width: `${Math.max(2, Math.min(98, yesPct))}%` }}
          />
        </div>
      </div>
      <div class="pred-row__meta">
        <span
          class={`pred-row__pct mono ${yesPct > 70 ? 'pred-row__pct--high' : yesPct < 30 ? 'pred-row__pct--low' : ''}`}
        >
          {yesPct.toFixed(1)}%
        </span>
        <span class={`pred-row__delta mono ${deltaClass(market.delta1h)}`}>
          1h {formatDelta(market.delta1h)}
        </span>
        <span class={`pred-row__delta mono ${deltaClass(market.delta24h)}`}>
          24h {formatDelta(market.delta24h)}
        </span>
        <span class="pred-row__vol mono">{formatVolume(market.volume24h)}</span>
      </div>
    </div>
  );
}
