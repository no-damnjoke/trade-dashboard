import { useState } from 'preact/hooks';
import { usePolling } from '../hooks/usePolling';
import { fetchJSON } from '../services/api';
import { formatRelativeTime } from '../utils/time';
import type { MarketState } from '../types';
import './StatusBar.css';

export function StatusBar() {
  const { data, lastUpdated } = usePolling<MarketState>(() => fetchJSON('/market-state'), 10_000);
  const [toggling, setToggling] = useState(false);
  const providers = data?.headlines.providers ?? [];
  const telegram = providers.find(provider => provider.id === 'telegram');
  const x = providers.find(provider => provider.id === 'x');

  const aiEnabled = data?.aiProvider.enabled && data?.aiProvider.available;

  async function toggleAI() {
    setToggling(true);
    try {
      await fetch('/api/ai-status/toggle', { method: 'POST' });
    } finally {
      setToggling(false);
    }
  }

  return (
    <footer class="statusbar">
      <div class="statusbar__left">
        <StatusDot label="Backend" ok={!!data} detail={data ? 'live' : 'down'} />
        <StatusDot label="Telegram" ok={telegram?.state === 'ok'} detail={telegram?.state ?? 'stale'} />
        <StatusDot label="X Backup" ok={(x?.state ?? 'blocked') !== 'blocked'} detail={x?.state ?? 'blocked'} />
        <StatusDot
          label="Signals"
          ok={(data?.monitor.assetsTracked ?? 0) > 0}
          detail={`${data?.monitor.pairsTracked ?? 0} FX / ${data?.monitor.cryptoTracked ?? 0} crypto`}
        />
        <StatusDot
          label="USD Regime"
          ok={!!data?.regime}
          detail={data?.regime.usdBias ?? 'mixed'}
        />
        <button
          class={`statusbar__ai-toggle ${aiEnabled ? 'statusbar__ai-toggle--on' : 'statusbar__ai-toggle--off'}`}
          onClick={toggleAI}
          disabled={toggling}
          title={aiEnabled ? 'Click to pause AI (saves API costs)' : 'Click to resume AI agents'}
        >
          <span class={`statusbar__dot ${aiEnabled ? 'statusbar__dot--ok' : 'statusbar__dot--err'}`} />
          <span class="statusbar__label">AI</span>
          <span class="statusbar__detail mono">{aiEnabled ? 'on' : 'off'}</span>
        </button>
      </div>
      <div class="statusbar__right">
        {data?.headlines.lastUpdated ? (
          <span class="statusbar__text mono">
            Headlines {formatRelativeTime(data.headlines.lastUpdated)}
          </span>
        ) : null}
        {lastUpdated > 0 && (
          <span class="statusbar__text mono">
            Sync {formatRelativeTime(lastUpdated)}
          </span>
        )}
      </div>
    </footer>
  );
}

function StatusDot({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <span class="statusbar__indicator" title={detail}>
      <span class={`statusbar__dot ${ok ? 'statusbar__dot--ok' : 'statusbar__dot--err'}`} />
      <span class="statusbar__label">{label}</span>
      <span class="statusbar__detail mono">{detail}</span>
    </span>
  );
}
