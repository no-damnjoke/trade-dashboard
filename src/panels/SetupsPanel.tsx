import { Panel } from '../components/Panel';
import { SetupRow } from '../components/SetupRow';
import { usePolling } from '../hooks/usePolling';
import { fetchJSON } from '../services/api';
import type { TechnicalSetup } from '../types';

interface SetupsResponse {
  setups: TechnicalSetup[];
  lastUpdated: number;
}

export function SetupsPanel() {
  const { data } = usePolling<SetupsResponse>(() => fetchJSON('/fx-setup'), 10_000);
  const setups = data?.setups ?? [];

  return (
    <Panel id="setups" title="G10 FX Setups" badge={setups.length || undefined}>
      {setups.length === 0 ? (
        <div class="panel-empty">
          <span class="panel-empty__text">No active setups</span>
          <span class="panel-empty__sub">G10 FX setup engine is live, but no setup qualifies yet</span>
        </div>
      ) : (
        setups.map(setup => <SetupRow key={setup.id} setup={setup} />)
      )}
    </Panel>
  );
}
