import { formatVolume } from '../utils/format';
import type { PredictionMarket } from '../types';
import './PredictionRow.css';

export function PredictionRow({ market }: { market: PredictionMarket }) {
  const raw = market.outcomePrices[0] ?? 0;
  const yesPrice = typeof raw === 'string' ? parseFloat(raw) : raw;
  const yesPct = (yesPrice * 100).toFixed(0);
  const hasWhales = (market.whaleProfiles?.length || 0) > 0;
  const isHighVolume = market.volume24h > 100_000;
  const topProfile = market.whaleProfiles?.[0];
  const sideLabel = market.side || 'unknown';
  const entry = market.avgEntryPrice != null ? `${(market.avgEntryPrice * 100).toFixed(1)}%` : 'n/a';
  const mark = market.currentMark != null ? `${(market.currentMark * 100).toFixed(1)}%` : 'n/a';
  const notional = `$${Math.round(market.estimatedSizeUsd || 0).toLocaleString()}`;

  return (
    <div class={`pred-row ${hasWhales ? 'pred-row--whale' : isHighVolume ? 'pred-row--hot' : ''}`}>
      <div class="pred-row__question">
        {market.question}
      </div>
      <div class="pred-row__meta">
        <span
          class={`pred-row__pct mono ${yesPrice > 0.7 ? 'pred-row__pct--high' : yesPrice < 0.3 ? 'pred-row__pct--low' : ''}`}
          title="Current market-implied YES probability"
        >
          YES {yesPct}%
        </span>
        <span class="pred-row__vol mono">{formatVolume(market.volume24h)}</span>
        {market.confidenceLabel && <span class="pred-row__spike">{market.confidenceLabel}</span>}
      </div>
      <div class="pred-row__position">
        <span class="pred-row__position-item mono">{sideLabel}</span>
        <span class="pred-row__position-item mono">{notional}</span>
        <span class="pred-row__position-item mono">entry {entry}</span>
        <span class="pred-row__position-item mono">mark {mark}</span>
      </div>
      {topProfile && (
        <div class="pred-row__profiles">
          <span class="pred-row__profile">{topProfile.label}</span>
        </div>
      )}
    </div>
  );
}
