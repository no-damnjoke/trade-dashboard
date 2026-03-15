import { formatTimestamp, isRecent } from '../utils/time';
import type { Headline } from '../types';
import './HeadlineRow.css';

function cleanText(text: string): string {
  return text
    .replace(/\s*\(\s*@\w+\s*\)\s*/g, '')
    .replace(/\s*\(@\w+\s*\)\s*/g, '')
    .trim();
}

export function HeadlineRow({ headline }: { headline: Headline }) {
  const recent = isRecent(headline.timestamp);

  return (
    <div class={`headline-row headline-row--${headline.importance} ${recent ? 'headline-row--recent' : ''}`}>
      <div class="headline-row__meta">
        <span class="headline-row__time mono">{formatTimestamp(headline.timestamp)}</span>
        <span class={`headline-row__tag headline-row__tag--${headline.importance}`}>{headline.importance}</span>
        {headline.thesisChange && <span class="headline-row__tag headline-row__tag--thesis">thesis change</span>}
      </div>
      <span class="headline-row__text">{cleanText(headline.text)}</span>
    </div>
  );
}
