import { Panel } from '../components/Panel';
import { HeadlineRow } from '../components/HeadlineRow';
import { usePolling } from '../hooks/usePolling';
import { fetchJSON } from '../services/api';
import type { Headline } from '../types';
import './HeadlinesPanel.css';

interface HeadlinesResponse {
  headlines: Headline[];
  lastUpdated: number;
  source: string;
}

export function HeadlinesPanel() {
  const { data } = usePolling<HeadlinesResponse>(
    () => fetchJSON('/headlines'),
    30_000,
  );

  const headlines = data?.headlines ?? [];
  const source = data?.source ?? 'telegram';

  return (
    <Panel id="headlines" title={`Headlines · ${source}`} badge={headlines.length || undefined}>
      {headlines.length === 0 ? (
        <div class="panel-empty">
          <span class="panel-empty__text">Waiting for headlines...</span>
          <span class="panel-empty__sub">Fetching from First Squawk Telegram</span>
        </div>
      ) : (
        headlines.map(h => <HeadlineRow key={h.id} headline={h} />)
      )}
    </Panel>
  );
}
