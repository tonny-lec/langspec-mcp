import { load } from 'cheerio';
import type { FetchResult, FetchOutcome, FetchError as FetchErrorType } from '../types.js';
import type { DocConfig } from '../config/languages.js';
import { createLogger } from '../lib/logger.js';
import { withRetry, FetchError, parseRetryAfter } from '../lib/retry.js';
import type { DiskCache } from '../lib/cache.js';

const log = createLogger('Fetcher');
const USER_AGENT = 'langspec-mcp/1.0 (Language Specification Indexer)';
const FETCH_TIMEOUT_MS = 30_000;

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function adaptDelay(currentDelayMs: number, error: unknown): number {
  if (error instanceof FetchError && error.status === 429) {
    const newDelay = error.retryAfter != null
      ? error.retryAfter * 1000
      : Math.min(currentDelayMs * 2, 10_000);
    log.info('Rate limited, increasing delay', { previousMs: currentDelayMs, newMs: newDelay });
    return newDelay;
  }
  return currentDelayMs;
}

export interface FetchUrlResult {
  body: string | null;
  etag: string | null;
  status: number;
}

async function fetchUrl(url: string, knownEtag?: string): Promise<FetchUrlResult> {
  return withRetry(async () => {
    const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
    if (knownEtag) {
      headers['If-None-Match'] = knownEtag;
    }

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (response.status === 304) {
      log.debug('Not modified (304)', { url });
      return { body: null, etag: knownEtag ?? null, status: 304 };
    }

    if (!response.ok) {
      const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
      throw new FetchError(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
        url,
        response.status,
        retryAfter,
      );
    }

    const body = await response.text();
    const etag = response.headers.get('etag');
    return { body, etag, status: 200 };
  });
}

interface CacheContext {
  cache: DiskCache;
  language: string;
  doc: string;
}

async function fetchWithCache(
  url: string,
  ctx?: CacheContext,
): Promise<FetchUrlResult> {
  const cachedEtag = ctx?.cache.getMeta(ctx.language, ctx.doc, url)?.etag ?? undefined;
  const result = await fetchUrl(url, cachedEtag);

  if (result.status === 304 && ctx) {
    // Serve from cache
    const cached = ctx.cache.getContent(ctx.language, ctx.doc, url);
    if (cached != null) {
      return { body: cached, etag: result.etag, status: 304 };
    }
    // Cache miss despite 304 — shouldn't happen, but fall through
  }

  if (result.status === 200 && result.body != null && ctx) {
    ctx.cache.put(ctx.language, ctx.doc, url, result.body, result.etag);
  }

  return result;
}

async function fetchSingleHtml(config: DocConfig, snapshotEtag?: string, ctx?: CacheContext): Promise<FetchOutcome> {
  const url = config.url!;
  log.info('Fetching', { url });
  // For single-html, prefer snapshot ETag from DB, but also check cache
  const cacheEtag = ctx?.cache.getMeta(ctx.language, ctx.doc, url)?.etag;
  const etagToUse = snapshotEtag ?? cacheEtag ?? undefined;
  const { body, etag, status } = await fetchUrl(url, etagToUse);
  if (status === 304) {
    // Try to serve from cache if we have content
    if (ctx) {
      const cached = ctx.cache.getContent(ctx.language, ctx.doc, url);
      if (cached != null) {
        log.info('Not modified, serving from cache', { url });
        return {
          results: [{ html: cached, etag, url, status: 304 }],
          errors: [],
          summary: { total: 1, fetched: 0, cached: 1, failed: 0 },
        };
      }
    }
    log.info('Not modified, skipping', { url });
    return {
      results: [{ html: '', etag, url, status: 304 }],
      errors: [],
      summary: { total: 1, fetched: 0, cached: 1, failed: 0 },
    };
  }
  if (ctx && body) {
    ctx.cache.put(ctx.language, ctx.doc, url, body, etag);
  }
  log.info('Fetched', { url, bytes: body!.length, etag: etag ?? 'none' });
  return {
    results: [{ html: body!, etag, url, status: 200 }],
    errors: [],
    summary: { total: 1, fetched: 1, cached: 0, failed: 0 },
  };
}

async function fetchMultiHtmlToc(config: DocConfig, ctx?: CacheContext): Promise<FetchOutcome> {
  const indexUrl = config.indexUrl!;
  const baseUrl = indexUrl.replace(/\/[^/]*$/, '');

  log.info('Fetching TOC', { url: indexUrl });
  const { body: indexHtml } = await fetchUrl(indexUrl);

  // Extract chapter links from the TOC page
  const $ = load(indexHtml!);
  const chapterLinks: string[] = [];

  $('a[href]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href && /^jls-\d+\.html$/.test(href)) {
      if (!chapterLinks.includes(href)) {
        chapterLinks.push(href);
      }
    }
  });

  log.info('Found chapters', { count: chapterLinks.length });

  const results: FetchResult[] = [];
  const errors: FetchErrorType[] = [];
  let fetched = 0, cached = 0;
  let delayMs = 200;

  for (let i = 0; i < chapterLinks.length; i++) {
    const link = chapterLinks[i];
    const chapterUrl = `${baseUrl}/${link}`;
    try {
      log.debug('Fetching chapter', { file: link, progress: `${i + 1}/${chapterLinks.length}` });
      const result = await fetchWithCache(chapterUrl, ctx);
      if (result.status === 304) cached++;
      else fetched++;
      results.push({ html: result.body ?? '', etag: result.etag, url: chapterUrl, pageUrl: chapterUrl, status: result.status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn('Failed to fetch page, continuing', { url: chapterUrl, error: msg });
      errors.push({ url: chapterUrl, error: msg });
      delayMs = adaptDelay(delayMs, err);
    }
    await delay(delayMs);
  }

  return {
    results,
    errors,
    summary: { total: chapterLinks.length, fetched, cached, failed: errors.length },
  };
}

export function parseSummaryMd(markdown: string, basePath: string): string[] {
  const files: string[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    // Match markdown links: [Title](path.md) or [Title](path/file.md)
    const match = line.match(/\[.*?\]\(([^)]+\.md)\)/);
    if (match) {
      const filePath = match[1];
      // Skip SUMMARY.md itself
      if (filePath === 'SUMMARY.md') continue;
      files.push(`${basePath}/${filePath}`);
    }
  }

  return files;
}

async function fetchGithubMarkdown(config: DocConfig, ctx?: CacheContext): Promise<FetchOutcome> {
  const { githubOwner, githubRepo, githubPath, manifestFile } = config;
  const rawBase = `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/HEAD`;
  const basePath = githubPath ?? '';

  let mdFiles: string[];

  if (manifestFile) {
    // Fetch SUMMARY.md or equivalent manifest
    const manifestUrl = `${rawBase}/${basePath}/${manifestFile}`;
    log.info('Fetching manifest', { url: manifestUrl });
    const { body: manifest } = await fetchUrl(manifestUrl);
    mdFiles = parseSummaryMd(manifest!, basePath);
    log.info('Found files in manifest', { count: mdFiles.length });
  } else {
    // Use GitHub API to list files in directory
    const apiUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${basePath}`;
    log.info('Listing files', { url: apiUrl });
    const { body } = await fetchUrl(apiUrl);
    const entries = JSON.parse(body!) as Array<{ name: string; path: string; type: string }>;
    mdFiles = entries
      .filter(e => e.type === 'file' && e.name.endsWith('.md'))
      .map(e => e.path);
    log.info('Found markdown files', { count: mdFiles.length });
  }

  const results: FetchResult[] = [];
  const errors: FetchErrorType[] = [];
  let fetched = 0, cached = 0;
  let delayMs = 100;

  for (let i = 0; i < mdFiles.length; i++) {
    const filePath = mdFiles[i];
    const fileUrl = `${rawBase}/${filePath}`;
    try {
      log.debug('Fetching', { file: filePath, progress: `${i + 1}/${mdFiles.length}` });
      const result = await fetchWithCache(fileUrl, ctx);
      if (result.status === 304) cached++;
      else fetched++;
      results.push({
        html: result.body ?? '',
        etag: result.etag,
        url: fileUrl,
        pageUrl: filePath,
        status: result.status,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn('Failed to fetch page, continuing', { url: fileUrl, error: msg });
      errors.push({ url: fileUrl, error: msg });
      delayMs = adaptDelay(delayMs, err);
    }
    await delay(delayMs);
  }

  return {
    results,
    errors,
    summary: { total: mdFiles.length, fetched, cached, failed: errors.length },
  };
}

export interface FetchSpecOptions {
  snapshotEtag?: string;
  cache?: DiskCache;
  language?: string;
}

export async function fetchSpec(config: DocConfig, opts: FetchSpecOptions = {}): Promise<FetchOutcome> {
  const ctx = opts.cache && opts.language ? {
    cache: opts.cache,
    language: opts.language,
    doc: config.doc,
  } : undefined;

  switch (config.fetchStrategy) {
    case 'single-html':
      return fetchSingleHtml(config, opts.snapshotEtag, ctx);
    case 'multi-html-toc':
      return fetchMultiHtmlToc(config, ctx);
    case 'github-markdown':
      return fetchGithubMarkdown(config, ctx);
    default:
      throw new Error(`Unknown fetch strategy: ${config.fetchStrategy}`);
  }
}

// Backward compatibility
export async function fetchGoSpec(): Promise<FetchResult> {
  const outcome = await fetchSingleHtml({
    doc: 'go-spec',
    displayName: 'Go Spec',
    fetchStrategy: 'single-html',
    url: 'https://go.dev/ref/spec',
    sourcePolicy: 'excerpt_only',
  });
  return outcome.results[0];
}
