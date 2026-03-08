import { formatTimestamp, isRecent } from '../utils/time';
import type { Headline } from '../types';
import './HeadlineRow.css';

export function HeadlineRow({ headline }: { headline: Headline }) {
  const recent = isRecent(headline.timestamp);
  const showWhy = headline.actionability !== 'ignore';
  const provenance = headline.classificationMethod === 'ai'
    ? 'AI'
    : headline.fallbackReason
      ? 'Deterministic Fallback'
      : 'Deterministic';

  return (
    <div class={`headline-row headline-row--${headline.importance} ${recent ? 'headline-row--recent' : ''}`}>
      <div class="headline-row__meta">
        <span class="headline-row__time mono">{formatTimestamp(headline.timestamp)}</span>
        <span class={`headline-row__tag headline-row__tag--${headline.importance}`}>{headline.importance}</span>
        <span class="headline-row__tag">{provenance}</span>
        {headline.thesisChange && <span class="headline-row__tag headline-row__tag--thesis">thesis change</span>}
        {typeof headline.confidence === 'number' && <span class="headline-row__tag">{headline.confidence}%</span>}
        <span class="headline-row__tag">{headline.provider}</span>
        <span class="headline-row__tag">{headline.marketImpact}</span>
      </div>
      <span class="headline-row__text">{headline.text}</span>
      {showWhy && (
        <div class="headline-row__why">
          <span>{headline.whyItMatters}</span>
        </div>
      )}
    </div>
  );
}
