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
        <g fill="#13243d" stroke="rgba(125,211,252,0.08)" stroke-width="1">
          {/* North America + Greenland + Central America */}
          <path d="M248.5,50.4L252.2,51.2L254.7,56.0L260.3,55.8L262.4,49.0L270.5,49.8L274.4,53.2L274.3,57.0L268.5,61.1L261.8,60.6L258.2,65.2L254.2,69.1L248.0,70.8L244.6,73.5L238.2,80.2L237.0,87.0L242.3,90.8L247.5,92.8L255.4,95.6L260.9,98.2L268.4,99.8L271.0,103.2L273.9,110.6L280.2,112.7L280.2,103.7L282.7,100.2L287.4,95.4L285.3,90.1L285.2,83.8L283.0,75.3L289.7,75.4L294.9,74.8L300.9,78.0L306.7,79.6L307.5,87.0L312.1,89.5L318.8,83.8L322.8,85.3L329.5,93.9L332.0,98.0L339.0,100.9L341.8,104.9L345.1,106.7L343.3,111.9L336.7,114.4L328.5,117.8L318.4,117.0L313.2,119.8L305.7,125.9L304.8,128.5L315.1,121.1L321.7,122.4L320.0,128.5L324.5,132.9L331.9,128.4L333.9,132.2L324.3,136.6L318.4,140.5L316.2,137.3L316.6,134.5L314.0,136.1L308.2,139.0L303.6,142.3L303.3,144.7L305.3,146.6L303.8,147.7L300.4,148.2L296.3,150.6L294.5,151.3L291.9,156.5L291.5,158.3L289.1,162.4L287.9,155.7L288.1,160.0L289.0,163.6L289.6,168.2L285.0,171.8L281.8,174.1L280.0,176.5L275.4,180.4L273.6,185.0L275.1,190.3L276.3,194.3L277.5,200.7L276.7,204.1L274.5,204.2L273.0,201.8L270.3,196.2L270.4,192.5L267.5,187.7L263.6,188.8L261.7,187.0L256.9,186.5L252.3,186.4L251.6,187.9L252.2,190.0L250.6,189.9L247.6,190.5L243.1,189.1L239.3,188.5L234.4,191.9L230.2,195.0L229.5,199.0L230.2,201.9L228.6,207.4L228.1,213.7L229.5,217.3L231.9,222.6L233.6,226.3L237.7,228.7L242.3,227.3L246.1,226.1L248.5,222.7L249.2,218.8L254.0,217.0L258.2,216.9L258.8,219.3L256.6,223.4L256.7,225.6L255.3,227.4L255.0,230.9L254.0,235.2L253.0,236.5L255.2,237.2L257.3,236.6L261.1,236.1L263.9,236.1L265.6,236.7L267.3,238.1L268.3,243.2L267.9,246.1L267.4,250.4L267.6,253.7L269.4,257.0L272.8,260.6L276.3,260.0L280.4,258.8L285.1,261.6L289.8,257.7L293.9,252.4L300.7,248.5L302.4,249.6L301.1,253.6L302.0,259.9L305.1,252.2L308.7,251.9L316.0,254.7L321.3,254.7L328.1,254.5L331.0,259.1L335.8,263.9L340.2,269.7L347.1,270.7L356.0,275.8L359.7,285.1L360.0,291.9L365.0,296.0L376.6,299.1L388.9,301.6L401.1,309.5L403.1,315.1L402.4,322.9L393.3,336.9L391.2,351.4L386.7,364.3L380.3,371.4L367.6,378.1L364.8,389.5L356.7,402.0L350.5,411.1L341.3,411.2L337.7,409.4L342.4,418.1L339.6,424.2L329.9,426.8L327.4,432.9L319.1,434.3L323.7,439.5L318.9,442.7L313.1,449.8L316.7,458.8L311.6,464.8L310.7,473.4L303.2,475.3L301.6,478.7L295.3,475.1L290.3,466.6L291.2,457.3L293.5,444.8L295.3,442.2L296.6,428.0L298.5,415.0L301.8,396.2L304.4,373.7L305.1,360.3L301.7,353.4L288.9,342.5L283.1,327.7L276.3,314.4L274.7,305.7L278.4,300.9L276.2,294.8L279.0,288.3L281.5,283.8L285.8,278.3L285.2,271.4L282.1,263.7L280.2,260.4L276.7,262.9L274.8,264.5L271.9,263.3L267.5,261.6L264.7,257.3L262.9,257.5L261.7,256.5L261.9,253.2L259.7,250.7L256.8,246.3L256.1,245.2L252.1,244.9L246.6,243.3L239.2,236.3L231.8,237.3L223.1,233.7L215.3,229.3L207.0,222.4L207.6,218.5L205.5,212.6L196.5,202.8L193.4,197.4L188.3,191.1L185.7,183.4L182.8,182.2L181.5,186.9L185.4,191.8L187.6,196.1L191.7,203.8L194.4,212.4L191.8,208.3L184.8,198.7L180.4,195.4L182.9,192.5L179.1,189.0L174.6,178.7L170.8,173.5L164.9,171.5L159.7,160.5L155.0,145.8L155.3,128.9L153.6,124.4L158.0,124.9L158.8,121.5L153.0,118.1L144.9,110.0L137.4,101.4L129.1,93.1L117.2,88.5L100.1,83.3L88.8,83.4L78.6,86.3L79.4,80.8L74.2,87.3L68.6,91.2L59.9,97.2L49.3,100.6L44.9,100.6L55.4,95.8L62.4,89.1L58.2,88.8L51.8,87.9L48.6,83.4L42.6,82.4L39.6,76.1L42.9,72.4L52.9,68.7L48.7,67.5L37.7,67.1L33.0,63.6L43.1,60.5L48.6,59.9L43.2,56.9L43.2,52.4L53.0,47.1L69.3,44.6L84.1,46.8L108.4,49.6L130.8,50.3L143.4,48.6L154.4,48.1L162.6,49.3L179.9,52.4L192.2,56.2L197.7,54.5L207.4,53.6L222.5,56.2L233.0,54.7L238.2,51.8L232.0,48.3L235.5,41.9L243.3,49.7L248.5,50.4Z" />
          {/* South America */}
          <path d="M278.7,212.6L279.8,213.9L285.7,216.5L290.0,218.7L293.9,221.2L291.8,222.5L284.0,222.7L285.9,220.8L283.0,219.7L281.3,216.7L277.2,215.9L272.7,214.6L270.1,212.9L266.9,214.7L265.1,216.0L264.0,215.6L266.0,213.3L268.7,211.9L273.9,211.4L278.7,212.6Z" />
          {/* Europe */}
          <path d="M459.7,60.9L459.1,63.2L462.2,65.5L458.6,68.2L450.6,70.6L444.5,70.7L436.8,69.6L439.5,68.0L433.5,66.4L438.3,64.7L432.4,63.9L434.3,61.6L438.5,61.1L442.8,63.4L447.1,61.5L450.6,62.5L455.1,60.7L459.7,60.9Z" />
          <path d="M491.7,88.1L488.7,91.8L491.5,91.4L494.6,91.4L493.8,94.2L491.3,97.3L494.2,97.5L496.9,102.0L500.5,106.5L504.7,108.5L504.3,110.8L504.0,113.6L501.5,115.4L493.1,116.3L490.0,117.3L487.4,116.9L484.0,117.5L488.0,113.9L486.2,112.5L485.4,111.1L488.3,110.1L486.7,108.2L487.3,105.9L491.8,104.2L489.9,102.0L486.5,101.4L486.9,98.9L484.5,99.6L484.3,96.3L482.9,94.5L483.9,90.9L486.1,88.1L491.7,88.1Z" />
          <path d="M344.1,115.7L342.2,118.7L347.4,120.4L351.5,120.7L352.5,122.6L353.8,126.6L351.3,129.8L349.5,129.1L346.1,128.9L343.7,126.3L335.4,126.4L334.9,125.3L337.8,121.1L340.7,115.6L344.8,112.4L345.6,113.5L344.1,115.7Z" />
          {/* Africa + Madagascar */}
          <path d="M639.0,338.7L639.5,342.9L640.2,344.5L639.4,347.2L638.5,345.2L638.5,348.8L637.5,351.1L636.2,358.1L633.1,369.4L630.8,378.3L626.1,380.6L622.3,378.4L621.4,373.5L620.2,368.3L620.6,365.8L621.9,364.0L623.5,359.2L622.3,355.3L622.1,352.1L623.5,348.0L626.4,347.1L628.6,346.5L632.5,342.3L633.0,339.1L635.7,337.1L636.7,333.5L638.4,336.4L639.0,338.7Z" />
          {/* Asia + Middle East (main landmass) */}
          <path d="M797.1,24.4L800.4,25.3L816.3,30.1L806.0,33.1L813.9,34.8L829.9,36.2L848.3,36.2L857.2,38.1L864.7,45.9L881.9,43.9L890.2,38.7L917.6,43.0L944.0,47.0L955.7,49.8L974.5,52.0L988.1,49.0L1000.0,52.2L1000.0,66.1L992.7,74.6L974.2,82.2L960.7,82.8L950.0,89.4L950.4,96.8L944.5,106.9L934.5,112.2L931.8,99.4L939.9,90.1L956.9,74.5L942.5,77.2L924.5,87.2L912.6,86.2L895.0,86.7L875.4,101.6L885.6,103.3L892.6,107.3L889.1,123.4L883.9,130.9L870.9,143.0L863.3,145.1L860.3,149.7L855.5,152.7L855.0,156.1L859.6,167.9L856.1,170.5L851.6,167.8L849.1,159.9L847.2,157.8L848.1,154.3L845.2,153.0L837.7,155.0L835.5,150.7L830.6,155.4L832.5,162.7L835.1,166.3L835.1,175.8L838.6,181.6L839.1,188.1L834.4,197.7L821.9,212.6L814.6,215.1L805.2,221.2L800.1,216.8L794.1,223.1L795.6,229.2L803.7,245.0L801.0,253.4L791.1,259.6L786.4,252.9L780.5,245.1L777.8,248.9L775.4,257.1L779.1,265.9L784.4,270.4L787.5,282.0L789.6,286.0L781.6,282.1L778.3,273.2L776.4,266.2L773.6,262.6L773.8,257.2L773.6,246.1L769.9,232.9L762.0,228.4L756.6,219.9L753.9,212.6L749.6,215.1L741.6,217.0L733.2,228.1L726.9,235.0L722.9,243.6L720.4,255.9L716.5,263.0L712.8,260.8L708.0,247.4L703.1,229.4L697.7,219.6L687.3,208.5L674.7,204.1L659.4,202.3L652.0,199.7L641.3,191.6L634.9,187.8L634.5,192.5L639.3,199.0L641.1,205.7L643.3,202.1L643.8,207.3L650.0,207.9L656.6,200.0L656.7,205.1L663.1,209.8L666.1,214.2L662.5,220.7L660.5,225.5L657.0,228.9L653.5,231.8L647.5,233.9L642.1,239.0L633.2,243.0L626.7,245.5L623.6,247.5L620.1,243.9L618.9,238.7L618.5,233.4L614.5,226.8L608.7,217.7L605.6,208.1L602.6,202.8L597.6,194.2L596.2,190.6L594.9,195.1L590.1,188.0L590.9,192.0L596.7,204.7L601.9,214.6L605.2,227.9L610.6,238.1L618.3,246.5L622.5,255.4L632.0,253.0L636.9,252.0L641.8,252.9L639.1,263.6L635.0,273.1L622.4,288.0L612.9,300.3L610.0,306.8L609.6,315.4L608.9,321.1L612.4,329.0L613.3,342.7L611.4,347.6L600.8,356.5L596.4,362.8L598.3,367.5L598.3,373.4L595.0,377.8L590.5,387.0L587.0,393.8L580.3,403.4L572.0,408.6L565.5,409.0L557.5,411.2L552.4,411.3L550.7,407.2L548.8,398.4L543.3,388.3L540.0,374.5L537.1,364.1L532.6,351.7L532.7,346.5L535.4,337.3L538.0,328.9L535.9,322.8L534.0,313.5L530.8,305.5L524.5,294.4L525.8,287.6L524.9,278.1L518.6,276.9L512.0,269.9L502.9,271.1L492.1,274.3L483.8,274.3L479.1,276.6L472.5,272.2L465.5,266.4L462.0,258.7L459.2,254.7L455.3,251.7L453.6,244.5L451.0,240.5L454.0,233.8L455.1,228.8L454.1,220.3L453.9,214.7L457.1,207.1L459.9,200.5L463.5,195.7L471.1,190.6L474.2,178.6L482.7,169.6L489.9,168.8L499.6,167.1L513.4,163.7L521.5,163.6L528.3,164.2L530.0,170.7L530.9,176.1L538.7,178.1L550.1,184.8L555.1,181.4L563.6,178.3L569.2,180.9L579.0,183.9L586.0,182.1L591.6,183.9L595.8,181.9L597.6,176.8L599.7,168.7L598.8,164.7L584.4,165.8L575.1,160.9L575.8,151.3L589.9,146.7L606.5,149.5L615.8,146.0L611.0,140.9L603.9,134.0L604.6,129.7L599.5,129.7L597.3,133.2L592.6,136.9L590.2,134.3L585.4,129.9L580.9,136.0L576.9,143.8L575.5,150.4L570.7,149.8L563.4,151.1L563.8,156.4L559.2,161.0L556.0,154.1L553.7,150.3L551.3,144.2L542.2,138.0L537.9,134.9L536.5,132.9L534.4,135.8L539.0,143.2L544.1,147.4L549.3,151.8L547.4,156.6L543.6,159.0L542.8,152.6L537.9,148.7L529.2,142.6L523.4,138.1L512.7,141.0L505.8,148.5L499.2,155.2L496.0,161.7L486.1,165.5L481.9,163.4L475.3,163.6L475.4,158.8L474.9,153.6L475.0,147.4L477.8,139.8L490.2,140.8L496.2,138.8L493.8,128.2L490.8,121.9L503.7,117.6L510.6,112.4L519.7,105.2L523.8,102.8L522.9,94.4L529.4,91.2L530.3,95.6L527.6,100.8L533.2,103.5L549.0,101.2L555.2,101.2L559.9,92.3L567.5,91.0L564.8,86.2L577.7,85.2L578.0,81.6L561.9,82.0L559.8,77.4L559.8,72.3L570.3,64.1L561.6,63.5L549.6,73.8L549.5,81.1L545.7,93.6L536.0,99.4L532.7,92.2L519.6,90.0L514.7,84.5L516.4,74.3L541.0,56.2L564.0,47.9L586.9,47.0L593.8,51.0L614.2,59.8L606.6,62.5L597.1,68.0L601.4,66.7L610.5,64.2L623.7,59.9L628.7,60.2L649.2,52.6L654.0,54.0L669.7,52.3L668.2,49.1L692.2,53.4L689.3,50.8L685.3,45.0L692.2,38.7L699.6,43.7L704.6,54.1L698.0,61.4L706.1,58.0L705.1,51.8L708.0,41.2L709.1,44.0L721.3,40.6L728.5,35.2L741.2,34.9L750.7,29.0L768.6,28.1L783.3,23.3L794.6,23.0L797.1,24.4Z" />
          {/* Japan */}
          <path d="M891.6,162.7L890.6,165.5L889.6,169.7L881.2,171.5L877.2,175.5L875.2,171.5L870.4,172.3L863.9,174.0L866.7,176.6L864.8,182.5L861.7,182.6L862.4,179.4L859.5,176.1L863.6,172.8L868.4,168.6L876.9,168.3L879.8,162.1L885.7,160.3L889.0,154.7L889.7,148.6L894.2,152.8L891.6,159.1L891.6,162.7Z" />
          {/* Australia */}
          <path d="M898.8,339.5L901.6,340.9L904.1,348.2L905.7,355.1L913.5,362.5L916.9,368.5L921.1,375.3L925.4,384.2L925.9,394.0L923.5,404.7L918.7,413.8L916.7,421.6L912.0,422.9L904.1,425.7L898.9,426.4L890.7,423.7L886.3,415.7L882.6,413.5L883.0,408.5L877.7,412.8L872.5,405.7L864.8,401.0L850.4,403.5L843.5,409.3L834.9,409.5L829.2,412.3L821.0,411.1L819.6,408.4L821.7,403.5L819.6,394.0L816.8,386.6L815.1,380.6L817.3,383.0L815.0,376.3L815.9,369.7L820.7,366.3L826.2,363.7L835.7,360.0L839.7,353.5L844.1,350.9L853.0,339.6L860.1,343.6L861.6,337.2L868.3,333.7L873.3,333.5L878.5,333.5L878.6,337.8L876.2,342.8L882.2,348.0L886.8,352.0L892.4,348.6L893.4,341.2L895.9,328.7L897.7,334.5L898.8,339.5Z" />
          {/* New Zealand */}
          <path d="M985.0,417.2L987.0,420.9L988.8,422.1L992.9,423.5L995.9,422.6L995.2,425.6L992.2,427.6L991.8,430.1L990.3,432.7L986.8,436.4L985.1,435.0L986.7,432.2L982.8,428.9L984.9,426.4L985.3,421.5L984.2,418.5L982.9,417.1L980.7,414.0L980.6,411.3L984.2,414.1L985.0,417.2Z" />
          <path d="M980.6,433.7L981.2,435.2L984.0,436.7L981.2,440.9L978.6,444.0L975.5,447.6L971.8,452.6L967.8,453.5L963.0,452.2L964.0,448.3L969.3,444.2L973.7,441.1L976.6,436.7L978.0,433.9L980.6,433.7Z" />
          {/* Indonesia */}
          <path d="M827.4,285.3L830.5,288.5L826.3,291.3L826.4,294.5L823.8,296.8L822.6,305.6L819.1,305.9L816.0,303.6L811.3,303.7L808.5,302.3L805.8,297.2L803.0,293.3L803.0,287.0L806.7,285.9L809.4,282.3L813.9,280.9L817.2,276.0L820.7,272.8L824.2,267.6L826.8,269.4L831.1,272.9L829.0,274.4L827.5,277.3L825.9,280.4L827.9,283.7L827.4,285.3Z" />
          <path d="M793.9,312.0L790.9,312.1L785.0,306.3L780.3,298.8L775.7,291.0L773.9,285.3L769.9,280.2L764.9,274.4L766.5,272.8L773.2,276.8L776.9,280.6L782.4,284.4L786.3,289.7L788.9,295.3L791.4,299.8L794.7,302.3L793.9,312.0Z" />
          {/* Greenland + Arctic islands */}
          <path d="M309.7,3.1L323.1,3.8L328.1,5.7L314.6,7.9L307.0,11.7L286.4,16.2L288.3,17.3L282.3,22.5L269.0,26.2L251.1,24.5L254.8,21.2L264.0,22.4L262.8,17.4L259.7,14.8L272.6,12.3L256.7,12.1L249.4,9.5L253.0,6.5L268.9,5.8L288.2,2.9L309.7,3.1Z" />
          <path d="M424.7,1.7L437.0,5.8L411.4,6.3L436.4,6.6L435.6,9.9L456.2,7.2L466.1,9.4L453.2,12.7L445.3,18.2L448.7,24.4L439.8,25.6L446.2,33.7L443.2,35.4L438.0,39.5L434.9,41.4L439.6,46.3L430.0,46.0L430.5,51.2L414.8,55.1L399.0,62.6L387.0,66.5L382.2,76.7L379.5,83.0L371.5,80.4L356.6,70.7L352.8,54.3L358.1,51.6L355.5,50.1L347.9,47.6L351.6,45.7L348.0,39.6L344.1,35.9L329.8,27.4L306.5,26.5L309.0,23.2L296.8,19.3L317.5,16.0L323.1,9.7L341.1,6.3L366.7,6.7L376.3,8.1L389.2,2.8L424.7,1.7Z" />
          {/* Borneo + SE Asia */}
          <path d="M872.6,295.7L876.3,303.4L886.6,298.8L901.6,305.1L910.1,312.8L908.3,315.0L914.7,323.2L918.9,327.4L913.7,327.4L905.7,319.7L898.4,322.9L889.3,320.5L883.4,318.0L877.7,307.5L869.4,305.9L868.8,303.2L871.4,299.4L866.2,297.3L867.7,292.9L872.6,295.7Z" />
          <path d="M847.9,286.7L845.7,290.2L840.9,290.2L833.8,290.8L835.9,296.6L842.6,293.8L842.4,295.4L840.0,296.9L840.2,302.7L842.1,307.9L840.6,311.2L838.2,308.5L835.8,304.2L834.2,301.8L834.5,310.9L832.8,311.4L831.9,303.8L829.9,301.4L831.5,296.4L833.4,289.7L838.0,288.1L844.7,288.5L847.9,286.7Z" />
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
