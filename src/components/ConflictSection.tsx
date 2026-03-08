import type { OpportunityConflict } from '../types';
import './ConflictSection.css';

const RECOMMENDATION_LABELS: Record<OpportunityConflict['recommendation'], string> = {
  watch: 'Watch',
  fade: 'Fade',
  wait: 'Wait',
};

export function ConflictSection({ conflicts }: { conflicts: OpportunityConflict[] }) {
  return (
    <div class="conflict-section">
      <span class="conflict-section__label">Divergences</span>
      {conflicts.map((conflict, i) => (
        <div key={i} class="conflict-item">
          <span class="conflict-item__instrument">{conflict.instrument}</span>
          <span class={`conflict-item__rec conflict-item__rec--${conflict.recommendation}`}>
            {RECOMMENDATION_LABELS[conflict.recommendation]}
          </span>
          <span class="conflict-item__desc">{conflict.description}</span>
        </div>
      ))}
    </div>
  );
}
