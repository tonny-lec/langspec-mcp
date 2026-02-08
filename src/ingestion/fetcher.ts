import type { FetchResult } from '../types.js';

export async function fetchGoSpec(): Promise<FetchResult> {
  const url = 'https://go.dev/ref/spec';

  console.error(`[Fetcher] Fetching ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'langspec-mcp/1.0 (Language Specification Indexer)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const etag = response.headers.get('etag');

  console.error(`[Fetcher] Fetched ${html.length} bytes, etag=${etag ?? 'none'}`);

  return { html, etag, url };
}
