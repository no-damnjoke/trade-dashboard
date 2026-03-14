export interface DataPoint {
  value: number;
  date: string; // ISO date
  source: string;
}

export interface SeriesFetchResult {
  ok: boolean;
  value?: number;
  formatted?: string;
  previousValue?: number;
  date?: string;
  source?: string;
  error?: string;
  stale?: boolean;
}

export type RefreshTier = 'fast' | 'medium' | 'slow';
