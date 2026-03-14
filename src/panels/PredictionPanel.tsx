import { Panel } from '../components/Panel';
import { PredictionRow } from '../components/PredictionRow';
import { usePolling } from '../hooks/usePolling';
import { fetchJSON } from '../services/api';
import type { PredictionMarket } from '../types';

interface PredictionsResponse {
  markets: PredictionMarket[];
  lastUpdated: number;
}

export function PredictionPanel() {
  const { data } = usePolling<PredictionsResponse>(
    () => fetchJSON('/predictions'),
    120_000,
  );

  const markets = data?.markets ?? [];

  return (
    <Panel id="predictions" title="Event Odds" badge={markets.length || undefined}>
      {markets.length === 0 ? (
        <div class="panel-empty">
          <span class="panel-empty__text">Loading event odds...</span>
          <span class="panel-empty__sub">Tracking macro-relevant prediction markets</span>
        </div>
      ) : (
        markets.map(m => <PredictionRow key={m.id} market={m} />)
      )}
    </Panel>
  );
}
