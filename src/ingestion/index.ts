import type Database from 'better-sqlite3';
import { fetchSpec } from './fetcher.js';
import { parseSpec } from './parser.js';
import { normalizeSections } from './normalizer.js';
import { DatabaseQueries } from '../db/queries.js';
import { getDocConfig } from '../config/languages.js';
import type { DocConfig } from '../config/languages.js';
import type { UpsertResult } from '../db/queries.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Ingestion');

export async function ingestSpec(db: Database.Database, language: string): Promise<void> {
  const docConfig = getDocConfig(language);
  log.info('Starting ingestion', { language, doc: docConfig.doc });

  const queries = new DatabaseQueries(db);
  const version = `snapshot-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;

  // 1. Fetch all pages
  const fetchResults = await fetchSpec(docConfig);
  log.info('Fetched pages', { count: fetchResults.length });

  // 2. Parse + normalize all pages
  const allNormalized: import('../types.js').NormalizedSection[] = [];
  for (const result of fetchResults) {
    const parsedSections = parseSpec(result.html, docConfig, result.pageUrl);
    const normalized = normalizeSections(parsedSections, {
      language,
      doc: docConfig.doc,
      version,
      baseUrl: docConfig.canonicalBaseUrl ?? docConfig.url ?? '',
      sourcePolicy: docConfig.sourcePolicy,
      pageUrlPrefix: docConfig.githubPath,
    });
    allNormalized.push(...normalized);
  }

  log.info('Total sections', { count: allNormalized.length });

  // 3. Persist (transaction) with diff-based counting
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
      etag: fetchResults[0]?.etag ?? null,
      source_url: docConfig.url ?? docConfig.indexUrl ?? `github:${docConfig.githubOwner}/${docConfig.githubRepo}`,
    });

    for (const section of allNormalized) {
      const result = queries.upsertSection(section);
      counters[result]++;
    }
  });

  transaction();

  log.info('Summary', { inserted: counters.inserted, updated: counters.updated, unchanged: counters.unchanged });
  log.info('Completed successfully');
}

// Backward compatibility
export async function ingestGoSpec(db: Database.Database): Promise<void> {
  return ingestSpec(db, 'go');
}
