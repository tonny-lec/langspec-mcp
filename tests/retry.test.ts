import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, FetchError, parseRetryAfter } from '../src/lib/retry.js';
import { adaptDelay } from '../src/ingestion/fetcher.js';
import { setLogLevel } from '../src/lib/logger.js';

describe('withRetry', () => {
  beforeEach(() => {
    setLogLevel('error'); // suppress retry logs in tests
  });

  afterEach(() => {
    setLogLevel('info');
  });

  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 503 and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new FetchError('503', 'http://x', 503))
      .mockResolvedValue('recovered');

    const result = await withRetry(fn, { initialDelayMs: 10 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 404 (non-retryable)', async () => {
    const fn = vi.fn()
      .mockRejectedValue(new FetchError('404', 'http://x', 404));

    await expect(withRetry(fn, { initialDelayMs: 10 })).rejects.toThrow('404');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 with Retry-After', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new FetchError('429', 'http://x', 429, 1))
      .mockResolvedValue('ok');

    const start = Date.now();
    const result = await withRetry(fn, { initialDelayMs: 10 });
    const elapsed = Date.now() - start;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    // Retry-After is 1 second, so delay should be ~1000ms
    expect(elapsed).toBeGreaterThanOrEqual(900);
  });

  it('throws after max retries exceeded', async () => {
    const fn = vi.fn()
      .mockRejectedValue(new FetchError('500', 'http://x', 500));

    await expect(withRetry(fn, { maxRetries: 2, initialDelayMs: 10 }))
      .rejects.toThrow('500');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('retries on TypeError (DNS/connection error)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { initialDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('FetchError', () => {
  it('has correct properties', () => {
    const err = new FetchError('test', 'http://example.com', 503, 5);
    expect(err.name).toBe('FetchError');
    expect(err.url).toBe('http://example.com');
    expect(err.status).toBe(503);
    expect(err.retryAfter).toBe(5);
    expect(err.message).toBe('test');
  });
});

describe('parseRetryAfter', () => {
  it('parses integer seconds', () => {
    expect(parseRetryAfter('120')).toBe(120);
    expect(parseRetryAfter('0')).toBe(0);
  });

  it('returns undefined for null', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
  });

  it('parses HTTP-date format', () => {
    const futureDate = new Date(Date.now() + 60_000).toUTCString();
    const result = parseRetryAfter(futureDate);
    expect(result).toBeDefined();
    expect(result).toBeGreaterThanOrEqual(55);
    expect(result).toBeLessThanOrEqual(65);
  });

  it('returns 0 for past HTTP-date', () => {
    const pastDate = new Date(Date.now() - 60_000).toUTCString();
    expect(parseRetryAfter(pastDate)).toBe(0);
  });
});

describe('adaptDelay', () => {
  beforeEach(() => setLogLevel('error'));
  afterEach(() => setLogLevel('info'));

  it('increases delay on 429 with Retry-After', () => {
    const err = new FetchError('429', 'http://x', 429, 5);
    const newDelay = adaptDelay(100, err);
    expect(newDelay).toBe(5000); // 5 seconds * 1000
  });

  it('doubles delay on 429 without Retry-After (capped at 10s)', () => {
    const err = new FetchError('429', 'http://x', 429);
    expect(adaptDelay(200, err)).toBe(400);
    expect(adaptDelay(6000, err)).toBe(10_000); // capped
  });

  it('does not change delay for non-429 errors', () => {
    const err = new FetchError('500', 'http://x', 500);
    expect(adaptDelay(200, err)).toBe(200);

    const typeErr = new TypeError('DNS failure');
    expect(adaptDelay(200, typeErr)).toBe(200);
  });
});
