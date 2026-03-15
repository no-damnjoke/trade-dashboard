const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

export async function searchHeadline(query: string, count = 5): Promise<BraveSearchResult[]> {
  if (!BRAVE_API_KEY) return [];

  try {
    const params = new URLSearchParams({
      q: query,
      count: String(count),
      freshness: 'pd', // past day
      text_decorations: 'false',
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) return [];

    const data = await response.json();
    const results = data.web?.results || [];

    return results.slice(0, count).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      description: (r.description || '').slice(0, 200),
      age: r.age || undefined,
    }));
  } catch {
    return [];
  }
}
