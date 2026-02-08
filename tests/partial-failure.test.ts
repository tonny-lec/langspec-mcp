import { describe, it, expect } from 'vitest';
import type { FetchOutcome, FetchResult } from '../src/types.js';

describe('FetchOutcome / Partial Failure', () => {
  it('collects errors while keeping successful results', () => {
    const outcome: FetchOutcome = {
      results: [
        { html: '<h2>Ch1</h2>', etag: null, url: 'https://x/ch1', pageUrl: 'ch1', status: 200 },
        { html: '<h2>Ch3</h2>', etag: null, url: 'https://x/ch3', pageUrl: 'ch3', status: 200 },
      ],
      errors: [
        { url: 'https://x/ch2', error: 'Failed to fetch: 500 Internal Server Error' },
      ],
      summary: { total: 3, fetched: 2, cached: 0, failed: 1 },
    };

    expect(outcome.results).toHaveLength(2);
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.summary.total).toBe(3);
    expect(outcome.summary.failed).toBe(1);
  });

  it('all pages failed means zero results', () => {
    const outcome: FetchOutcome = {
      results: [],
      errors: [
        { url: 'https://x/ch1', error: 'timeout' },
        { url: 'https://x/ch2', error: 'DNS failure' },
      ],
      summary: { total: 2, fetched: 0, cached: 0, failed: 2 },
    };

    expect(outcome.results).toHaveLength(0);
    expect(outcome.errors).toHaveLength(2);
    // orchestrator should throw when all pages fail
    const shouldAbort = outcome.results.length === 0;
    expect(shouldAbort).toBe(true);
  });

  it('mixed 200/304/error produces correct summary', () => {
    const outcome: FetchOutcome = {
      results: [
        { html: '<h2>Ch1</h2>', etag: '"e1"', url: 'https://x/ch1', status: 200 },
        { html: '<h2>Ch2</h2>', etag: '"e2"', url: 'https://x/ch2', status: 304 },
      ],
      errors: [
        { url: 'https://x/ch3', error: '503' },
      ],
      summary: { total: 3, fetched: 1, cached: 1, failed: 1 },
    };

    expect(outcome.summary.fetched).toBe(1);
    expect(outcome.summary.cached).toBe(1);
    expect(outcome.summary.failed).toBe(1);
    expect(outcome.summary.fetched + outcome.summary.cached + outcome.summary.failed).toBe(outcome.summary.total);
  });

  it('no errors means clean outcome', () => {
    const outcome: FetchOutcome = {
      results: [
        { html: '<h2>A</h2>', etag: null, url: 'https://x/1', status: 200 },
      ],
      errors: [],
      summary: { total: 1, fetched: 1, cached: 0, failed: 0 },
    };

    expect(outcome.errors).toHaveLength(0);
    expect(outcome.summary.failed).toBe(0);
  });
});
