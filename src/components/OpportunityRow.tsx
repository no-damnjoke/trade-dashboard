import { formatRelativeTime } from '../utils/time';
import type { MarketOpportunity } from '../types';
import './OpportunityRow.css';

const LABELS: Record<MarketOpportunity['setupType'], string> = {
  macro_continuation: 'Continuation',
  event_reprice: 'Event Reprice',
  breakout_with_confirmation: 'Breakout',
  failed_break: 'Failed Break',
  cross_asset_divergence: 'Divergence',
};

export function OpportunityRow({ opportunity }: { opportunity: MarketOpportunity }) {
  const detailText = opportunity.commentary || opportunity.trigger || '';

  return (
    <div class={`opp-row opp-row--${opportunity.directionBias}`}>
      <div class="opp-row__header">
        <span class="opp-row__name">{opportunity.displayName}</span>
        {typeof opportunity.confidence === 'number' && (
          <span class="opp-row__signal">{opportunity.confidence}%</span>
        )}
        <span class={`opp-row__urgency opp-row__urgency--${opportunity.urgency}`}>{opportunity.urgency}</span>
        {opportunity.theme && (
          <span class="opp-row__theme">{opportunity.theme}</span>
        )}
      </div>
      <div class="opp-row__meta">
        <span class="opp-row__instrument mono">{opportunity.instrument}</span>
        <span class={`opp-row__bias opp-row__bias--${opportunity.directionBias}`}>
          {opportunity.directionBias === 'long' ? 'Bullish' : opportunity.directionBias === 'short' ? 'Bearish' : 'Watch'}
        </span>
        <span class="opp-row__type">{LABELS[opportunity.setupType]}</span>
      </div>
      <div class="opp-row__trigger">{detailText}</div>
      <div class="opp-row__footer">
        <span class="mono">{formatRelativeTime(opportunity.staleAfter)}</span>
      </div>
    </div>
  );
}
