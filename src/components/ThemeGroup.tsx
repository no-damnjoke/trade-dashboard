import { OpportunityRow } from './OpportunityRow';
import type { MarketOpportunity } from '../types';
import './ThemeGroup.css';

export function ThemeGroup({ theme, opportunities }: { theme: string; opportunities: MarketOpportunity[] }) {
  return (
    <div class="theme-group">
      {theme !== 'All' && (
        <div class="theme-group__header">
          <span class="theme-group__label">{theme}</span>
          <span class="theme-group__count">{opportunities.length}</span>
        </div>
      )}
      {opportunities.map(opportunity => (
        <OpportunityRow key={opportunity.id} opportunity={opportunity} />
      ))}
    </div>
  );
}
