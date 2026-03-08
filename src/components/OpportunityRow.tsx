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

function getBiasLabel(opportunity: MarketOpportunity) {
  if (opportunity.directionBias === 'long') return `Bullish ${opportunity.displayName}`;
  if (opportunity.directionBias === 'short') return `Bearish ${opportunity.displayName}`;
  return `Watch ${opportunity.displayName}`;
}

export function OpportunityRow({ opportunity }: { opportunity: MarketOpportunity }) {
  const provenance = opportunity.classificationMethod === 'ai'
    ? 'AI'
    : opportunity.fallbackReason
      ? 'Deterministic Fallback'
      : 'Deterministic';
  const biasLabel = getBiasLabel(opportunity);
  const sourceSummary = opportunity.sourceMix?.join(' + ') || opportunity.confirmationSignals[0] || '';
  const detailText = opportunity.commentary || opportunity.trigger;

  return (
    <div class={`opp-row opp-row--${opportunity.directionBias}`}>
      <div class="opp-row__header">
        <span class="opp-row__name">{opportunity.displayName}</span>
        <span class="opp-row__signal">{provenance}</span>
        {typeof opportunity.confidence === 'number' && (
          <span class="opp-row__signal">{opportunity.confidence}%</span>
        )}
        <span class={`opp-row__urgency opp-row__urgency--${opportunity.urgency}`}>{opportunity.urgency}</span>
        {opportunity.isSynthetic && (
          <span class="opp-row__signal opp-row__signal--synth">Synth</span>
        )}
        {opportunity.conflictFlag && (
          <span class="opp-row__signal opp-row__signal--conflict" title={opportunity.conflictFlag}>!</span>
        )}
      </div>
      <div class="opp-row__meta">
        <span>{LABELS[opportunity.setupType]}</span>
        <span class={`opp-row__bias opp-row__bias--${opportunity.directionBias}`}>{biasLabel}</span>
      </div>
      <div class="opp-row__trigger">{detailText}</div>
      <div class="opp-row__footer">
        <span class="opp-row__confirmation">{sourceSummary}</span>
        <span class="mono">{formatRelativeTime(opportunity.staleAfter)}</span>
      </div>
      <div class="opp-row__invalidation">
        <span class="opp-row__label">Invalidation</span>
        <span>{opportunity.invalidation}</span>
      </div>
    </div>
  );
}
