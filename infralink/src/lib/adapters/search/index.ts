import type { SearchProvider } from './types';
import { MockSearchProvider } from './mock';
import { BraveSearchProvider, SerperSearchProvider, TavilySearchProvider } from './http';

export * from './types';

let cached: SearchProvider | null = null;

export function getSearchProvider(): SearchProvider {
  if (cached) return cached;
  const kind = (process.env.SEARCH_PROVIDER ?? 'mock').toLowerCase();
  const key = process.env.SEARCH_API_KEY ?? '';
  if (kind === 'brave' && key) cached = new BraveSearchProvider(key);
  else if (kind === 'serper' && key) cached = new SerperSearchProvider(key);
  else if (kind === 'tavily' && key) cached = new TavilySearchProvider(key);
  else cached = new MockSearchProvider();
  return cached;
}

export function resetSearchProvider() {
  cached = null;
}
