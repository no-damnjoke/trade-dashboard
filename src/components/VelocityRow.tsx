import { formatRelativeTime } from '../utils/time';
import type { VelocitySignal } from '../types';
import './VelocityRow.css';

export function VelocityRow({ signal }: { signal: VelocitySignal }) {
  const arrow = signal.direction === 'up' ? '\u2191' : '\u2193';

  return (
    <div class={`vel-row vel-row--${signal.severity}`}>
      <div class="vel-row__header">
        <span class="vel-row__pair mono">{signal.displayName}</span>
        <span class="vel-row__severity">{signal.assetClass.toUpperCase()}</span>
        <span class={`vel-row__arrow vel-row__arrow--${signal.direction}`}>{arrow}</span>
        <span class="vel-row__severity">{signal.severity}</span>
        {!signal.actionable && <span class="vel-row__severity">VISUAL</span>}
        <span class="vel-row__time mono">{formatRelativeTime(signal.timestamp)}</span>
      </div>
      <div class="vel-row__metrics">
        <span class="vel-row__metric mono">
          <span class="vel-row__label">Move</span>
          {signal.moveBps.toFixed(1)}{signal.moveUnit}
        </span>
        <span class="vel-row__metric mono">
          <span class="vel-row__label">Vel</span>
          {Math.abs(signal.velocity).toFixed(2)}p/s
        </span>
        <span class="vel-row__metric mono">
          <span class="vel-row__label">Z</span>
          {signal.zScore.toFixed(1)}
        </span>
        <span class="vel-row__metric mono">
          <span class="vel-row__label">Acc</span>
          {signal.acceleration > 0 ? '+' : ''}{signal.acceleration.toFixed(3)}
        </span>
      </div>
    </div>
  );
}
