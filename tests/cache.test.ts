import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DiskCache } from '../src/lib/cache.js';
import { setLogLevel } from '../src/lib/logger.js';

describe('DiskCache', () => {
  let tempDir: string;
  let cache: DiskCache;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'langspec-cache-test-'));
    cache = new DiskCache(tempDir);
    setLogLevel('error');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    setLogLevel('info');
  });

  it('put and getContent round-trip', () => {
    const content = '<h2>Test</h2><p>Hello world</p>';
    cache.put('go', 'go-spec', 'https://go.dev/ref/spec', content, '"etag123"');

    const retrieved = cache.getContent('go', 'go-spec', 'https://go.dev/ref/spec');
    expect(retrieved).toBe(content);
  });

  it('put and getMeta round-trip', () => {
    cache.put('rust', 'rust-reference', 'https://example.com/intro.md', 'content', '"abc"');

    const meta = cache.getMeta('rust', 'rust-reference', 'https://example.com/intro.md');
    expect(meta).not.toBeNull();
    expect(meta!.url).toBe('https://example.com/intro.md');
    expect(meta!.etag).toBe('"abc"');
    expect(meta!.fetchedAt).toBeDefined();
  });

  it('has returns false for uncached URLs', () => {
    expect(cache.has('go', 'go-spec', 'https://not-cached.com')).toBe(false);
  });

  it('has returns true for cached URLs', () => {
    cache.put('go', 'go-spec', 'https://go.dev/ref/spec', 'data', null);
    expect(cache.has('go', 'go-spec', 'https://go.dev/ref/spec')).toBe(true);
  });

  it('cache key is deterministic for the same URL', () => {
    const url = 'https://example.com/page.html';
    cache.put('java', 'jls', url, 'content1', '"e1"');

    // Overwrite with same URL
    cache.put('java', 'jls', url, 'content2', '"e2"');

    const retrieved = cache.getContent('java', 'jls', url);
    expect(retrieved).toBe('content2');

    const meta = cache.getMeta('java', 'jls', url);
    expect(meta!.etag).toBe('"e2"');
  });
});
