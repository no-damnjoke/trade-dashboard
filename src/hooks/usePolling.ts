import { useEffect, useRef, useState } from 'preact/hooks';

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState(0);
  const timerRef = useRef<number>();
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const result = await fetcherRef.current();
        if (active) {
          setData(result);
          setLastUpdated(Date.now());
          setError(null);
        }
      } catch (e) {
        if (active) setError(e as Error);
      }
    };

    poll();
    timerRef.current = window.setInterval(poll, intervalMs);
    return () => {
      active = false;
      clearInterval(timerRef.current);
    };
  }, [intervalMs]);

  return { data, error, lastUpdated };
}
