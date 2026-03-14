import { useEffect, useState, useMemo } from 'preact/hooks';
import { Panel } from '../components/Panel';
import { usePolling } from '../hooks/usePolling';
import { fetchJSON } from '../services/api';
import { formatRelativeTime } from '../utils/time';
import type {
  CountryChartSeries,
  CountryIndicator,
  CountryResearchPacket,
  IndicatorCategory,
  MarketFundamentalsPayload,
  RateStance,
} from '../types';
import './MarketFundamentalsPanel.css';

const REFRESH_LABEL: Record<MarketFundamentalsPayload['refresh']['state'], string> = {
  fresh: 'Live',
  stale: 'Stale',
  degraded: 'Degraded',
};

const RATE_STANCE_LABEL: Record<RateStance, string> = {
  hiking: 'Hiking',
  cutting: 'Cutting',
  hold: 'Hold',
};

const CATEGORY_LABEL: Record<IndicatorCategory, string> = {
  policy_rate: 'Policy Rate',
  inflation: 'Inflation',
  labor: 'Labor',
  growth: 'Growth',
  trade: 'Trade',
  housing: 'Housing',
  commodity_link: 'Commodity Link',
  fiscal: 'Fiscal',
  intervention: 'Intervention',
  sentiment: 'Sentiment',
  yields: 'Yields',
  fx_reserves: 'FX Reserves',
};

const DIRECTION_ARROW: Record<string, string> = {
  up: '\u25B2',
  down: '\u25BC',
  flat: '\u2014',
};

export function MarketFundamentalsPanel() {
  const { data, error } = usePolling<MarketFundamentalsPayload>(
    () => fetchJSON('/market-fundamentals'),
    30_000,
  );
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    if (!selectedCode || !data.profiles[selectedCode]) {
      setSelectedCode(data.defaultCountryCode);
    }
  }, [data, selectedCode]);

  const profile = data && selectedCode ? data.profiles[selectedCode] : null;

  return (
    <Panel
      id="fundamentals"
      title="Market Fundamentals"
      badge={data ? REFRESH_LABEL[data.refresh.state] : 'Loading'}
    >
      {!data && error ? (
        <div class="panel-empty">
          <span class="panel-empty__text">Market Fundamentals unavailable</span>
          <span class="panel-empty__sub">Country packets did not load from the backend.</span>
        </div>
      ) : !data || !profile ? (
        <div class="panel-empty">
          <span class="panel-empty__text">Loading country packets...</span>
          <span class="panel-empty__sub">Preparing source-backed research.</span>
        </div>
      ) : (
        <div class="mf">
          <div class="mf__toolbar">
            <div class="mf__status">
              <span class={`mf__pill mf__pill--${data.refresh.state}`}>
                {'\u25CF'} {REFRESH_LABEL[data.refresh.state]}
              </span>
              <span class="mf__meta mono">
                Last updated: {formatRelativeTime(data.refresh.lastSuccessfulRefresh)}
              </span>
            </div>
            <div class="mf__meta mono">
              {data.countries.length} G10
            </div>
          </div>

          <div class="mf__layout">
            <section class="mf__map-wrap">
              <div class="mf__section-head">
                <div>
                  <div class="mf__eyebrow">World Map</div>
                  <h3 class="mf__heading">G10 Currency Map</h3>
                </div>
                <div class="mf__legend">
                  <span class="mf__legend-key"><span class="mf__legend-dot mf__legend-dot--hiking" /> hiking</span>
                  <span class="mf__legend-key"><span class="mf__legend-dot mf__legend-dot--cutting" /> cutting</span>
                  <span class="mf__legend-key"><span class="mf__legend-dot mf__legend-dot--hold" /> hold</span>
                </div>
              </div>
              <WorldMap
                countries={data.countries}
                selectedCode={profile.code}
                onSelect={setSelectedCode}
              />
            </section>

            <section class="mf__content">
              <PolicyHeader profile={profile} />

              <div class="mf__hero">
                <div>
                  <div class="mf__eyebrow">{profile.region} {'\u00B7'} {profile.currency}</div>
                  <div class="mf__title-row">
                    <h3 class="mf__heading">{profile.name}</h3>
                  </div>
                  <p class="mf__snapshot">{profile.summary}</p>
                </div>
                <div class="mf__anchor-list">
                  {profile.keyAnchors.map(anchor => (
                    <span key={anchor} class="mf__chip">{anchor}</span>
                  ))}
                </div>
              </div>

              <IndicatorGrid indicators={profile.indicators} />

              {profile.charts.length > 0 && (
                <div class="mf__chart-grid">
                  {profile.charts.map(chart => (
                    <ChartCard key={chart.id} chart={chart} />
                  ))}
                </div>
              )}

              <div class="mf__grid">
                <InsightCard profile={profile} />
              </div>

              <div class="mf__grid">
                <ListCard title="Key Themes" items={profile.keyThemes} accent="cyan" />
                <ListCard title="Structural Forces" items={profile.structuralForces} accent="violet" />
              </div>

              <div class="mf__grid">
                <DependencyCard profile={profile} />
                <SourceCard profile={profile} />
              </div>
            </section>
          </div>
        </div>
      )}
    </Panel>
  );
}

function PolicyHeader({ profile }: { profile: CountryResearchPacket }) {
  return (
    <div class="mf__policy-header">
      <span class="mf__policy-bank">{profile.centralBank}</span>
      <span class="mf__policy-sep">{'\u00B7'}</span>
      <span class="mf__policy-rate">{profile.policyRate}</span>
      <span class="mf__policy-sep">{'\u00B7'}</span>
      <span class={`mf__stance-badge mf__stance-badge--${profile.rateStance}`}>
        {RATE_STANCE_LABEL[profile.rateStance]}
      </span>
      {profile.nextKeyEvent && (
        <>
          <span class="mf__policy-sep">{'\u00B7'}</span>
          <span class="mf__policy-event">{profile.nextKeyEvent}</span>
        </>
      )}
    </div>
  );
}

function IndicatorGrid({ indicators }: { indicators: CountryIndicator[] }) {
  const primaryIndicators = useMemo(
    () => indicators.filter(i => i.isPrimary),
    [indicators],
  );
  const secondaryIndicators = useMemo(
    () => indicators.filter(i => !i.isPrimary),
    [indicators],
  );

  const grouped = useMemo(() => {
    const map = new Map<IndicatorCategory, CountryIndicator[]>();
    for (const ind of primaryIndicators) {
      const list = map.get(ind.category) || [];
      list.push(ind);
      map.set(ind.category, list);
    }
    return map;
  }, [primaryIndicators]);

  return (
    <div class="mf__indicator-section">
      <div class="mf__indicator-grid">
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category} class="mf__indicator-group">
            <div class="mf__indicator-category">{CATEGORY_LABEL[category] || category}</div>
            <div class="mf__indicator-cards">
              {items.map(ind => (
                <div key={ind.id} class="mf__indicator-card">
                  <div class="mf__indicator-label">{ind.label}</div>
                  <div class="mf__indicator-value">
                    {ind.value}
                    {ind.direction && (
                      <span class={`mf__indicator-arrow mf__indicator-arrow--${ind.direction}`}>
                        {DIRECTION_ARROW[ind.direction]}
                      </span>
                    )}
                  </div>
                  <div class="mf__indicator-source">{ind.sourceLabel}</div>
                  <div class="mf__indicator-signal">{ind.signal}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {secondaryIndicators.length > 0 && (
        <div class="mf__indicator-secondary">
          {secondaryIndicators.map(ind => (
            <div key={ind.id} class="mf__indicator-row">
              <span class="mf__indicator-row-label">{ind.label}</span>
              <span class="mf__indicator-row-value">
                {ind.value}
                {ind.direction && (
                  <span class={`mf__indicator-arrow mf__indicator-arrow--${ind.direction}`}>
                    {' '}{DIRECTION_ARROW[ind.direction]}
                  </span>
                )}
              </span>
              <span class="mf__indicator-row-signal">{ind.signal}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InsightCard({ profile }: { profile: CountryResearchPacket }) {
  return (
    <section class="mf__card mf__card--insight" style={{ gridColumn: '1 / -1' }}>
      <div class="mf__card-head">
        <div class="mf__section-title">AI Live Brief</div>
        <div class="mf__meta mono">
          {profile.insight.method === 'ai' ? `AI ${'\u00B7'} ${formatRelativeTime(profile.insight.generatedAt)}` : 'Deterministic fallback'}
        </div>
      </div>
      <p class="mf__snapshot">{profile.insight.summary}</p>
      <div class="mf__mini-grid">
        <MiniList title="Active Drivers" items={profile.insight.activeDrivers} />
        <MiniList title="What Changed" items={profile.insight.whatChanged} />
        <MiniList title="Game Theory" items={profile.insight.gameTheory} />
        <MiniList title="Trading Implications" items={profile.insight.tradingImplications} />
      </div>
    </section>
  );
}

function ChartCard({ chart }: { chart: CountryChartSeries }) {
  const max = Math.max(...chart.data);
  const min = Math.min(...chart.data);
  const chartWidth = 272;
  const step = chartWidth / Math.max(chart.data.length - 1, 1);
  const points = chart.data
    .map((value, index) => {
      const x = 24 + (index * step);
      const y = 116 - (((value - min) / Math.max(max - min, 1)) * 78);
      return `${x},${y}`;
    })
    .join(' ');

  const lastX = 24 + ((chart.data.length - 1) * step);

  return (
    <section class="mf__card mf__card--chart">
      <div class="mf__card-head">
        <div>
          <div class="mf__section-title">{chart.title}</div>
          <div class="mf__chart-sub">{chart.subtitle}</div>
        </div>
        <div class="mf__chart-latest">{chart.latest}</div>
      </div>
      <svg class="mf__spark" viewBox="0 0 320 140" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`fill-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={chart.color} stop-opacity="0.34" />
            <stop offset="100%" stop-color={chart.color} stop-opacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`M24 116 L ${points.replace(/ /g, ' L ')} L ${lastX} 116 Z`}
          fill={`url(#fill-${chart.id})`}
          opacity="0.88"
        />
        <polyline points={points} fill="none" stroke={chart.color} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        {chart.data.map((value, index) => {
          const x = 24 + (index * step);
          const y = 116 - (((value - min) / Math.max(max - min, 1)) * 78);
          return <circle key={`${chart.id}-${value}-${index}`} cx={x} cy={y} r="4" fill={chart.color} />;
        })}
      </svg>
      <div class="mf__axis">
        {chart.labels.map(label => <span key={label}>{label}</span>)}
      </div>
    </section>
  );
}

function ListCard(
  { title, items, accent }:
  { title: string; items: string[]; accent: 'cyan' | 'violet' },
) {
  return (
    <section class={`mf__card mf__card--${accent}`}>
      <div class="mf__section-title">{title}</div>
      <ul class="mf__list">
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function DependencyCard({ profile }: { profile: CountryResearchPacket }) {
  return (
    <section class="mf__card">
      <div class="mf__section-title">Game-Theory Links</div>
      <div class="mf__dependencies">
        {profile.dependencies.map(item => (
          <div key={`${item.countryCode}-${item.relationship}`} class="mf__dependency">
            <div class="mf__dependency-code">{item.countryCode}</div>
            <div class="mf__dependency-copy">
              <strong>{item.relationship}.</strong> {item.whyNow}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SourceCard({ profile }: { profile: CountryResearchPacket }) {
  return (
    <section class="mf__card">
      <div class="mf__card-head">
        <div class="mf__section-title">Official Sources</div>
        <div class="mf__meta mono">{profile.sources.length} cited</div>
      </div>
      <div class="mf__sources">
        {profile.sources.map(source => (
          <a key={source.id} class="mf__source" href={source.url} target="_blank" rel="noreferrer">
            <div class="mf__source-head">
              <span>{source.title}</span>
              <span class="mf__source-kind">{source.kind}</span>
            </div>
            <div class="mf__source-meta">{source.publisher} {'\u00B7'} {source.publishedAt}</div>
            <div class="mf__source-copy">{source.whyItMatters}</div>
          </a>
        ))}
      </div>
    </section>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div class="mf__mini-list">
      <div class="mf__mini-title">{title}</div>
      <ul class="mf__list">
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function WorldMap(
  { countries, selectedCode, onSelect }:
  { countries: MarketFundamentalsPayload['countries']; selectedCode: string; onSelect: (code: string) => void },
) {
  return (
    <div class="mf-map">
      <svg class="mf-map__svg" viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="mf-ocean" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#081120" />
            <stop offset="60%" stop-color="#0c1830" />
            <stop offset="100%" stop-color="#08111d" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="1000" height="420" rx="24" fill="url(#mf-ocean)" />
        <g fill="#13243d" stroke="rgba(125,211,252,0.08)" stroke-width="2">
          <path d="M76 84C120 40 204 36 256 70C284 88 299 123 282 152C260 188 208 190 174 214C148 232 143 278 110 286C78 294 52 267 47 233C41 193 30 130 76 84Z" />
          <path d="M232 250C259 241 286 252 295 278C306 310 292 350 268 374C246 394 216 380 211 351C205 316 205 262 232 250Z" />
          <path d="M396 84C444 51 533 60 574 99C601 124 591 166 555 177C509 192 463 198 429 173C394 148 363 108 396 84Z" />
          <path d="M476 188C517 173 572 183 590 218C606 251 599 311 568 341C535 373 489 363 476 328C463 293 438 203 476 188Z" />
          <path d="M612 84C687 39 822 42 875 88C910 119 906 166 868 189C823 216 772 206 728 225C697 238 677 273 641 269C603 265 574 225 580 187C586 147 579 103 612 84Z" />
          <path d="M782 284C819 268 885 273 908 306C922 327 916 357 891 366C857 378 813 381 786 360C760 338 744 301 782 284Z" />
        </g>
        <g stroke="rgba(56,189,248,0.12)" stroke-width="1">
          <path d="M0 120H1000" />
          <path d="M0 210H1000" />
          <path d="M0 300H1000" />
          <path d="M160 0V420" />
          <path d="M360 0V420" />
          <path d="M560 0V420" />
          <path d="M760 0V420" />
        </g>
      </svg>

      {countries.map(country => (
        <button
          key={country.code}
          type="button"
          class={`mf-map__node mf-map__node--${country.rateStance} ${selectedCode === country.code ? 'mf-map__node--active' : ''}`}
          style={{ left: `${country.position.x}%`, top: `${country.position.y}%` }}
          onClick={() => onSelect(country.code)}
        >
          <span class="mf-map__node-dot" />
          <span class="mf-map__node-label">{country.code}</span>
        </button>
      ))}
    </div>
  );
}
