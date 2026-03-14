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
      <svg class="mf-map__svg" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="mf-ocean" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#081120" />
            <stop offset="60%" stop-color="#0c1830" />
            <stop offset="100%" stop-color="#08111d" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="1000" height="500" rx="24" fill="url(#mf-ocean)" />
        <g fill="#13243d" stroke="rgba(125,211,252,0.08)" stroke-width="2">
          <path d="M165,95 L180,82 195,78 210,72 225,70 240,75 248,68 255,55 262,48 270,52 275,60 282,65 272,72 265,80 268,88 275,95 280,105 288,112 295,118 290,128 285,138 278,148 272,155 265,162 258,168 250,175 242,182 235,188 228,195 220,200 210,205 200,210 190,215 180,218 170,220 160,225 152,230 145,235 138,238 130,235 125,228 128,218 135,208 140,198 145,188 148,178 155,168 160,158 158,148 155,138 150,128 148,118 152,108 158,100 165,95Z" />
          <path d="M225,235 L232,228 240,225 248,228 255,235 260,245 265,258 268,270 272,282 275,295 276,308 275,322 272,335 268,348 262,358 255,365 248,370 240,372 232,368 225,360 218,348 215,335 212,322 210,308 212,295 215,282 218,270 220,258 222,245 225,235Z" />
          <path d="M440,75 L448,72 458,70 468,72 478,75 485,80 490,88 488,95 492,100 498,105 505,108 510,112 508,118 502,122 495,125 488,128 480,130 472,128 465,125 458,122 452,118 448,112 445,105 442,98 440,90 440,82 440,75Z" />
          <path d="M450,145 L458,140 468,138 478,140 488,145 498,152 505,160 510,170 515,182 518,195 520,208 520,222 518,235 515,248 510,260 505,270 498,278 490,285 480,290 470,292 460,290 452,285 445,278 440,270 438,260 435,248 434,235 434,222 435,208 438,195 440,182 442,170 445,160 448,152 450,145Z" />
          <path d="M520,55 L535,48 555,42 575,38 595,35 615,32 635,35 655,38 675,42 695,48 710,55 725,62 738,72 748,82 755,92 760,102 762,112 760,122 755,132 748,142 738,148 725,152 718,158 712,165 705,170 695,172 685,170 675,165 665,160 655,155 648,150 640,148 630,150 620,155 610,158 602,155 595,148 590,140 585,132 580,125 575,118 570,112 565,108 558,105 550,102 542,100 535,98 528,95 522,90 518,82 518,72 520,62 520,55Z" />
          <path d="M762,260 L775,255 790,252 805,255 818,260 828,268 835,278 838,290 835,302 828,312 818,318 805,322 790,320 775,318 765,312 758,302 755,290 758,278 762,268 762,260Z" />
          <path d="M858,325 L862,320 868,318 872,322 870,328 865,332 860,330 858,325Z" />
        </g>
        <g stroke="rgba(56,189,248,0.12)" stroke-width="1">
          <path d="M0 125H1000" />
          <path d="M0 250H1000" />
          <path d="M0 375H1000" />
          <path d="M200 0V500" />
          <path d="M400 0V500" />
          <path d="M600 0V500" />
          <path d="M800 0V500" />
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
