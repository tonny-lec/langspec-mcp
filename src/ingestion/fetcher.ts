import { load } from 'cheerio';
import type { FetchResult } from '../types.js';
import type { DocConfig } from '../config/languages.js';

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
  console.error(`[Fetcher] Fetching ${url}`);
  const { body, etag } = await fetchUrl(url);
  console.error(`[Fetcher] Fetched ${body.length} bytes, etag=${etag ?? 'none'}`);
  return [{ html: body, etag, url }];
}

async function fetchMultiHtmlToc(config: DocConfig): Promise<FetchResult[]> {
  const indexUrl = config.indexUrl!;
  const baseUrl = indexUrl.replace(/\/[^/]*$/, '');

  console.error(`[Fetcher] Fetching TOC from ${indexUrl}`);
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

  console.error(`[Fetcher] Found ${chapterLinks.length} chapters`);

  const results: FetchResult[] = [];
  for (const link of chapterLinks) {
    const chapterUrl = `${baseUrl}/${link}`;
    console.error(`[Fetcher] Fetching chapter: ${link}`);
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
    console.error(`[Fetcher] Fetching manifest: ${manifestUrl}`);
    const { body: manifest } = await fetchUrl(manifestUrl);
    mdFiles = parseSummaryMd(manifest, basePath);
    console.error(`[Fetcher] Found ${mdFiles.length} files in manifest`);
  } else {
    // Use GitHub API to list files in directory
    const apiUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${basePath}`;
    console.error(`[Fetcher] Listing files from ${apiUrl}`);
    const { body } = await fetchUrl(apiUrl);
    const entries = JSON.parse(body) as Array<{ name: string; path: string; type: string }>;
    mdFiles = entries
      .filter(e => e.type === 'file' && e.name.endsWith('.md'))
      .map(e => e.path);
    console.error(`[Fetcher] Found ${mdFiles.length} markdown files`);
  }

  const results: FetchResult[] = [];
  for (const filePath of mdFiles) {
    const fileUrl = `${rawBase}/${filePath}`;
    console.error(`[Fetcher] Fetching: ${filePath}`);
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
