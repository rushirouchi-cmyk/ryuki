import { classifySource, type SearchProvider, type SearchQuery, type SearchResult } from './types';
import { MockSearchProvider } from './mock';

function buildQueryString(query: SearchQuery) {
  return [...query.keywords, query.location, '採用', '求人'].filter(Boolean).join(' ');
}

/** Brave Search API */
export class BraveSearchProvider implements SearchProvider {
  readonly name = 'brave';
  constructor(private apiKey: string) {}

  async search(query: SearchQuery): Promise<SearchResult[]> {
    try {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.set('q', buildQueryString(query));
      url.searchParams.set('count', String(query.limit ?? 10));
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'x-subscription-token': this.apiKey },
      });
      if (!res.ok) return new MockSearchProvider().search(query);
      const data = (await res.json()) as {
        web?: { results?: { title: string; url: string; description?: string; age?: string }[] };
      };
      return (data.web?.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.description ?? '',
        sourceType: classifySource(r.url),
        publishedAt: r.age ?? null,
        // 検索スニペットからは勤務地を確定できないため未設定とする。
        location: null,
      }));
    } catch {
      return new MockSearchProvider().search(query);
    }
  }
}

/** Serper.dev (Google 検索 API ラッパー) */
export class SerperSearchProvider implements SearchProvider {
  readonly name = 'serper';
  constructor(private apiKey: string) {}

  async search(query: SearchQuery): Promise<SearchResult[]> {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-API-KEY': this.apiKey },
        body: JSON.stringify({ q: buildQueryString(query), num: query.limit ?? 10, gl: 'jp', hl: 'ja' }),
      });
      if (!res.ok) return new MockSearchProvider().search(query);
      const data = (await res.json()) as {
        organic?: { title: string; link: string; snippet?: string; date?: string }[];
      };
      return (data.organic ?? []).map((r) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet ?? '',
        sourceType: classifySource(r.link),
        publishedAt: r.date ?? null,
        location: null,
      }));
    } catch {
      return new MockSearchProvider().search(query);
    }
  }
}

/** Tavily Search API */
export class TavilySearchProvider implements SearchProvider {
  readonly name = 'tavily';
  constructor(private apiKey: string) {}

  async search(query: SearchQuery): Promise<SearchResult[]> {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          query: buildQueryString(query),
          max_results: query.limit ?? 10,
          search_depth: 'basic',
        }),
      });
      if (!res.ok) return new MockSearchProvider().search(query);
      const data = (await res.json()) as {
        results?: { title: string; url: string; content?: string; published_date?: string }[];
      };
      return (data.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content ?? '',
        sourceType: classifySource(r.url),
        publishedAt: r.published_date ?? null,
        location: null,
      }));
    } catch {
      return new MockSearchProvider().search(query);
    }
  }
}
