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
          <span class="panel-empty__text">No AI setups available</span>
          <span class="panel-empty__sub">Waiting for market structure to produce a qualified trade</span>
        </div>
      ) : (
        setups.map(setup => <SetupRow key={setup.id} setup={setup} />)
      )}
    </Panel>
  );
}
