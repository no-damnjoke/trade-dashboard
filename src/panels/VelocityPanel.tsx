import { Panel } from '../components/Panel';
import { VelocityRow } from '../components/VelocityRow';
import { usePolling } from '../hooks/usePolling';
import { fetchJSON } from '../services/api';
import type { VelocitySignal } from '../types';

interface VelocityResponse {
  signals: VelocitySignal[];
  monitor: {
    pairsTracked: number;
    cryptoTracked: number;
    samplesCollected: number;
    marketOpen: boolean;
    fxMarketOpen?: boolean;
  };
  timestamp: number;
}

export function VelocityPanel() {
  const { data } = usePolling<VelocityResponse>(
    () => fetchJSON('/velocity'),
    10_000,
  );

  const signals = data?.signals ?? [];
  const monitor = data?.monitor;
  const marketOpen = monitor?.marketOpen ?? true;

  return (
    <Panel
      id="velocity"
      title="Macro Shocks"
      badge={signals.length || undefined}
    >
      {!marketOpen ? (
        <div class="panel-empty">
          <span class="panel-empty__text">Macro Sessions Closed</span>
          <span class="panel-empty__sub">
            Live monitoring resumes when tracked markets reopen
          </span>
        </div>
      ) : signals.length === 0 ? (
        <div class="panel-empty">
          <span class="panel-empty__text">No active shocks</span>
          <span class="panel-empty__sub">
            Monitoring {monitor?.pairsTracked ?? 0} FX + {monitor?.cryptoTracked ?? 0} crypto
            {monitor?.samplesCollected
              ? ` \u00b7 ${monitor.samplesCollected} samples`
              : ' \u00b7 collecting baseline...'}
          </span>
        </div>
      ) : (
        signals.map(s => (
          <VelocityRow key={`${s.pair}-${s.timestamp}`} signal={s} />
        ))
      )}
    </Panel>
  );
}
