import type Database from 'better-sqlite3';
import { fetchSpec } from './fetcher.js';
import { parseSpec } from './parser.js';
import { normalizeSections } from './normalizer.js';
import { DatabaseQueries } from '../db/queries.js';
import { getDocConfig } from '../config/languages.js';
import type { DocConfig } from '../config/languages.js';
import type { UpsertResult } from '../db/queries.js';

export async function ingestSpec(db: Database.Database, language: string): Promise<void> {
  const docConfig = getDocConfig(language);
  console.error(`[Ingestion] Starting ${language} ingestion (${docConfig.doc})...`);

  const queries = new DatabaseQueries(db);
  const version = `snapshot-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;

  // 1. Fetch all pages
  const fetchResults = await fetchSpec(docConfig);
  console.error(`[Ingestion] Fetched ${fetchResults.length} page(s)`);

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

  console.error(`[Ingestion] Total sections: ${allNormalized.length}`);

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

  console.error(
    `[Ingestion] Summary: ${counters.inserted} inserted, ${counters.updated} updated, ${counters.unchanged} unchanged`
  );
  console.error('[Ingestion] Completed successfully');
}

// Backward compatibility
export async function ingestGoSpec(db: Database.Database): Promise<void> {
  return ingestSpec(db, 'go');
}
