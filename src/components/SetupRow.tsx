import { formatRelativeTime } from '../utils/time';
import type { TechnicalSetup } from '../types';
import './SetupRow.css';

const LABELS: Record<TechnicalSetup['type'], string> = {
  event_continuation: 'Event Continuation',
  range_break_accel: 'Range Break + Accel',
  failed_break_reversal: 'Failed Break Reversal',
  usd_regime_impulse: 'USD Regime Impulse',
};

function getDirectionLabel(setup: TechnicalSetup) {
  return setup.direction === 'long' ? 'Long' : 'Short';
}

export function SetupRow({ setup }: { setup: TechnicalSetup }) {
  const typeLabel = LABELS[setup.type as keyof typeof LABELS] || setup.type;
  const provenance = setup.classificationMethod === 'ai'
    ? 'AI'
    : setup.fallbackReason
      ? 'Deterministic Fallback'
      : 'Deterministic';
  return (
    <div class={`setup-row setup-row--${setup.direction}`}>
      <div class="setup-row__header">
        <span class="setup-row__type">{typeLabel}</span>
        <span class="setup-row__pair mono">{setup.pair}</span>
        {setup.quality && <span class="setup-row__badge">{setup.quality}</span>}
        <span class="setup-row__badge">{getDirectionLabel(setup)}</span>
        <span class="setup-row__badge">{provenance}</span>
        <span class="setup-row__confidence mono">{setup.confidence}%</span>
      </div>
      <div class="setup-row__factors">
        {setup.supportingFactors.slice(0, 3).map(factor => (
          <span key={factor} class="setup-row__factor">{factor}</span>
        ))}
      </div>
      <div class="setup-row__footer">
        <span>{setup.timeframeAlignment || setup.invalidation}</span>
        <span class="mono">stale {formatRelativeTime(setup.staleAfter)}</span>
      </div>
    </div>
  );
}
