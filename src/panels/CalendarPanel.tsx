import { useEffect, useRef } from 'preact/hooks';
import { Panel } from '../components/Panel';
import './CalendarPanel.css';

export function CalendarPanel() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme: 'dark',
      isTransparent: true,
      width: '100%',
      height: '100%',
      locale: 'en',
      timezone: 'Asia/Hong_Kong',
      importanceFilter: '0,1',
      countryFilter: 'us,eu,gb,jp,ch,au,nz,ca,se,no',
    });

    containerRef.current.innerHTML = '';
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    widgetDiv.appendChild(inner);
    widgetDiv.appendChild(script);
    containerRef.current.appendChild(widgetDiv);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  return (
    <Panel id="calendar" title="Economic Calendar">
      <div ref={containerRef} class="calendar-widget" />
    </Panel>
  );
}
