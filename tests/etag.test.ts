import { describe, it, expect } from 'vitest';
import type { FetchResult } from '../src/types.js';

describe('ETag / FetchResult status', () => {
  it('FetchResult with status 200 has html content', () => {
    const result: FetchResult = {
      html: '<h2>Test</h2><p>Content</p>',
      etag: '"abc123"',
      url: 'https://example.com/spec',
      status: 200,
    };
    expect(result.status).toBe(200);
    expect(result.html).toBeTruthy();
    expect(result.etag).toBe('"abc123"');
  });

  it('FetchResult with status 304 has empty html', () => {
    const result: FetchResult = {
      html: '',
      etag: '"abc123"',
      url: 'https://example.com/spec',
      status: 304,
    };
    expect(result.status).toBe(304);
    expect(result.html).toBe('');
  });

  it('all-304 results are detected correctly', () => {
    const results: FetchResult[] = [
      { html: '', etag: '"e1"', url: 'https://x/1', status: 304 },
      { html: '', etag: '"e2"', url: 'https://x/2', status: 304 },
    ];
    const allUnchanged = results.every(r => r.status === 304);
    expect(allUnchanged).toBe(true);
  });

  it('mixed 200/304 results are not all-unchanged', () => {
    const results: FetchResult[] = [
      { html: '<h2>A</h2>', etag: '"e1"', url: 'https://x/1', status: 200 },
      { html: '', etag: '"e2"', url: 'https://x/2', status: 304 },
    ];
    const allUnchanged = results.every(r => r.status === 304);
    expect(allUnchanged).toBe(false);

    // Only 200 results should be processed
    const toProcess = results.filter(r => r.status !== 304);
    expect(toProcess).toHaveLength(1);
    expect(toProcess[0].html).toBe('<h2>A</h2>');
  });
});
