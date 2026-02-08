import { load } from 'cheerio';
import type { FetchResult } from '../types.js';
import type { DocConfig } from '../config/languages.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Fetcher');
const USER_AGENT = 'langspec-mcp/1.0 (Language Specification Indexer)';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchUrl(url: string): Promise<{ body: string; etag: string | null }> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const body = await response.text();
  const etag = response.headers.get('etag');
  return { body, etag };
}

async function fetchSingleHtml(config: DocConfig): Promise<FetchResult[]> {
  const url = config.url!;
  log.info('Fetching', { url });
  const { body, etag } = await fetchUrl(url);
  log.info('Fetched', { url, bytes: body.length, etag: etag ?? 'none' });
  return [{ html: body, etag, url }];
}

async function fetchMultiHtmlToc(config: DocConfig): Promise<FetchResult[]> {
  const indexUrl = config.indexUrl!;
  const baseUrl = indexUrl.replace(/\/[^/]*$/, '');

  log.info('Fetching TOC', { url: indexUrl });
  const { body: indexHtml } = await fetchUrl(indexUrl);

  // Extract chapter links from the TOC page
  const $ = load(indexHtml);
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
  for (const link of chapterLinks) {
    const chapterUrl = `${baseUrl}/${link}`;
    log.debug('Fetching chapter', { file: link });
    const { body, etag } = await fetchUrl(chapterUrl);
    results.push({ html: body, etag, url: chapterUrl, pageUrl: chapterUrl });
    await delay(200);
  }

  return results;
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

async function fetchGithubMarkdown(config: DocConfig): Promise<FetchResult[]> {
  const { githubOwner, githubRepo, githubPath, manifestFile } = config;
  const rawBase = `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/HEAD`;
  const basePath = githubPath ?? '';

  let mdFiles: string[];

  if (manifestFile) {
    // Fetch SUMMARY.md or equivalent manifest
    const manifestUrl = `${rawBase}/${basePath}/${manifestFile}`;
    log.info('Fetching manifest', { url: manifestUrl });
    const { body: manifest } = await fetchUrl(manifestUrl);
    mdFiles = parseSummaryMd(manifest, basePath);
    log.info('Found files in manifest', { count: mdFiles.length });
  } else {
    // Use GitHub API to list files in directory
    const apiUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${basePath}`;
    log.info('Listing files', { url: apiUrl });
    const { body } = await fetchUrl(apiUrl);
    const entries = JSON.parse(body) as Array<{ name: string; path: string; type: string }>;
    mdFiles = entries
      .filter(e => e.type === 'file' && e.name.endsWith('.md'))
      .map(e => e.path);
    log.info('Found markdown files', { count: mdFiles.length });
  }

  const results: FetchResult[] = [];
  for (const filePath of mdFiles) {
    const fileUrl = `${rawBase}/${filePath}`;
    log.debug('Fetching', { file: filePath });
    const { body } = await fetchUrl(fileUrl);
    results.push({
      html: body,
      etag: null,
      url: fileUrl,
      pageUrl: filePath,
    });
    await delay(100);
  }

  return results;
}

export async function fetchSpec(config: DocConfig): Promise<FetchResult[]> {
  switch (config.fetchStrategy) {
    case 'single-html':
      return fetchSingleHtml(config);
    case 'multi-html-toc':
      return fetchMultiHtmlToc(config);
    case 'github-markdown':
      return fetchGithubMarkdown(config);
    default:
      throw new Error(`Unknown fetch strategy: ${config.fetchStrategy}`);
  }
}

// Backward compatibility
export async function fetchGoSpec(): Promise<FetchResult> {
  const results = await fetchSingleHtml({
    doc: 'go-spec',
    displayName: 'Go Spec',
    fetchStrategy: 'single-html',
    url: 'https://go.dev/ref/spec',
    sourcePolicy: 'excerpt_only',
  });
  return results[0];
}
