import type Database from 'better-sqlite3';
import { fetchSpec } from './fetcher.js';
import { parseSpec } from './parser.js';
import { normalizeSections } from './normalizer.js';
import { DatabaseQueries } from '../db/queries.js';
import { getDocConfig } from '../config/languages.js';
import type { DocConfig } from '../config/languages.js';
import type { UpsertResult } from '../db/queries.js';
import { createLogger } from '../lib/logger.js';
import { DiskCache } from '../lib/cache.js';

const log = createLogger('Ingestion');

export async function ingestSpec(db: Database.Database, language: string, cacheDir?: string): Promise<void> {
  const docConfig = getDocConfig(language);
  log.info('Starting ingestion', { language, doc: docConfig.doc });

  const queries = new DatabaseQueries(db);
  const version = `snapshot-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;

  // 1. Get previous ETag for conditional request (single-html only)
  const previousSnapshot = queries.getLatestSnapshot(language, docConfig.doc);
  const snapshotEtag = previousSnapshot?.etag ?? undefined;

  // 2. Fetch all pages (with disk cache if cacheDir provided)
  const cache = cacheDir ? new DiskCache(cacheDir) : undefined;
  const outcome = await fetchSpec(docConfig, { snapshotEtag, cache, language });

  log.info('Fetch summary', outcome.summary);

  // Report errors if any
  if (outcome.errors.length > 0) {
    for (const err of outcome.errors) {
      log.warn('Page fetch failed', { url: err.url, error: err.error });
    }
  }

  // All pages failed — abort
  if (outcome.results.length === 0) {
    throw new Error(`All ${outcome.summary.total} pages failed to fetch for ${language}`);
  }

  // Check if all results are 304 (no changes)
  const allUnchanged = outcome.results.every(r => r.status === 304);
  if (allUnchanged) {
    log.info('No changes detected (all 304), skipping parse and persist');
    return;
  }

  // 3. Parse + normalize pages with new content
  const allNormalized: import('../types.js').NormalizedSection[] = [];
  for (const result of outcome.results) {
    if (result.status === 304) continue;
    const parsedSections = parseSpec(result.html, docConfig, result.pageUrl);
    const normalized = normalizeSections(parsedSections, {
      language,
      doc: docConfig.doc,
      version,
      baseUrl: docConfig.canonicalBaseUrl ?? docConfig.url ?? '',
      sourcePolicy: docConfig.sourcePolicy,
      pageUrlPrefix: docConfig.githubPath,
      urlSuffix: docConfig.urlSuffix,
    });
    allNormalized.push(...normalized);
  }

  log.info('Total sections', { count: allNormalized.length });

  // 4. Persist (transaction) with diff-based counting
  const counters: Record<UpsertResult, number> = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
  };

  const transaction = db.transaction(() => {
    queries.upsertSnapshot({
      language,
      doc: docConfig.doc,
      version,
      fetched_at: new Date().toISOString(),
      etag: outcome.results[0]?.etag ?? null,
      source_url: docConfig.url ?? docConfig.indexUrl ?? `github:${docConfig.githubOwner}/${docConfig.githubRepo}`,
    });

    for (const section of allNormalized) {
      const result = queries.upsertSection(section);
      counters[result]++;
    }
  });

  transaction();

  log.info('Summary', {
    inserted: counters.inserted,
    updated: counters.updated,
    unchanged: counters.unchanged,
    failed_pages: outcome.errors.length,
  });
  log.info('Completed successfully');
}

// Backward compatibility
export async function ingestGoSpec(db: Database.Database): Promise<void> {
  return ingestSpec(db, 'go');
}
