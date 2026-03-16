import { formatRelativeTime } from '../utils/time';
import type { TechnicalSetup } from '../types';
import './SetupRow.css';

const LABELS: Record<TechnicalSetup['type'], string> = {
  event_continuation: 'Event Continuation',
  range_break_accel: 'Range Break + Accel',
  failed_break_reversal: 'Failed Break Reversal',
  usd_regime_impulse: 'USD Regime Impulse',
};

export function SetupRow({ setup }: { setup: TechnicalSetup }) {
  const typeLabel = LABELS[setup.type as keyof typeof LABELS] || setup.type;
  return (
    <div class={`setup-row setup-row--${setup.direction}`}>
      <div class="setup-row__header">
        <span class="setup-row__pair mono">{setup.pair}</span>
        <span class={`setup-row__badge setup-row__badge--${setup.direction}`}>
          {setup.direction === 'long' ? '\u2191 Long' : '\u2193 Short'}
        </span>
        <span class="setup-row__type">{typeLabel}</span>
        {setup.riskRewardRatio != null && (
          <span class="setup-row__rr">{setup.riskRewardRatio.toFixed(1)}R</span>
        )}
      </div>
      <div class="setup-row__factors">
        {setup.supportingFactors.slice(0, 3).map(factor => (
          <span key={factor} class="setup-row__factor">{factor}</span>
        ))}
      </div>
      <div class="setup-row__levels">
        <div class="setup-row__level-block">
          <span class="setup-row__level-label">Entry</span>
          <span class="setup-row__level-value mono">{setup.entryZone ?? '\u2014'}</span>
        </div>
        <div class="setup-row__level-block">
          <span class="setup-row__level-label">Stop Loss</span>
          <span class="setup-row__level-value setup-row__level-value--sl mono">{setup.stopLoss ?? '\u2014'}</span>
        </div>
        <div class="setup-row__level-block">
          <span class="setup-row__level-label">Targets</span>
          <span class="setup-row__level-value mono">{setup.targets?.join(' / ') ?? '\u2014'}</span>
        </div>
      </div>
      <div class="setup-row__footer">
        <span class="mono">stale {formatRelativeTime(setup.staleAfter)}</span>
      </div>
    </div>
  );
}
