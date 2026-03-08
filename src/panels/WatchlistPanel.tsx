import { Panel } from '../components/Panel';
import { NarrativeBlock } from '../components/NarrativeBlock';
import { ConflictSection } from '../components/ConflictSection';
import { ThemeGroup } from '../components/ThemeGroup';
import { usePolling } from '../hooks/usePolling';
import { fetchJSON } from '../services/api';
import type { MarketOpportunity, OpportunityConflict } from '../types';
import './WatchlistPanel.css';

interface OpportunitiesResponse {
  opportunities: MarketOpportunity[];
  narrative: string;
  themes: string[];
  conflicts: OpportunityConflict[];
  lastUpdated: number;
}

function groupByTheme(
  opportunities: MarketOpportunity[],
  themes: string[],
): Array<{ theme: string; opportunities: MarketOpportunity[] }> {
  if (themes.length === 0 || !opportunities.some(o => o.theme)) {
    return [{ theme: 'All', opportunities }];
  }

  const groups = new Map<string, MarketOpportunity[]>();
  for (const theme of themes) {
    groups.set(theme, []);
  }
  groups.set('Other', []);

  for (const opp of opportunities) {
    const theme = opp.theme && groups.has(opp.theme) ? opp.theme : 'Other';
    groups.get(theme)!.push(opp);
  }

  return Array.from(groups.entries())
    .filter(([, opps]) => opps.length > 0)
    .map(([theme, opps]) => ({ theme, opportunities: opps }));
}

export function WatchlistPanel() {
  const { data } = usePolling<OpportunitiesResponse>(() => fetchJSON('/opportunities'), 10_000);
  const opportunities = data?.opportunities ?? [];
  const narrative = data?.narrative ?? '';
  const themes = data?.themes ?? [];
  const conflicts = data?.conflicts ?? [];

  const grouped = groupByTheme(opportunities, themes);

  return (
    <Panel id="watchlist" title="Opportunity Board" badge={opportunities.length || undefined}>
      {narrative && <NarrativeBlock narrative={narrative} />}
      {conflicts.length > 0 && <ConflictSection conflicts={conflicts} />}
      {opportunities.length === 0 ? (
        <div class="panel-empty">
          <span class="panel-empty__text">No live opportunities</span>
          <span class="panel-empty__sub">Waiting for catalyst and confirmation to align</span>
        </div>
      ) : (
        grouped.map(group => (
          <ThemeGroup key={group.theme} theme={group.theme} opportunities={group.opportunities} />
        ))
      )}
    </Panel>
  );
}
