import type Database from 'better-sqlite3';
import { fetchGoSpec } from './fetcher.js';
import { parseGoSpec } from './parser.js';
import { normalizeSections } from './normalizer.js';
import { DatabaseQueries } from '../db/queries.js';
import type { UpsertResult } from '../db/queries.js';

export async function ingestGoSpec(db: Database.Database): Promise<void> {
  console.error('[Ingestion] Starting Go spec ingestion...');

  const queries = new DatabaseQueries(db);

  // 1. Fetch
  const fetchResult = await fetchGoSpec();

  // 2. Parse
  const parsedSections = parseGoSpec(fetchResult.html, fetchResult.url);

  // 3. Normalize
  const version = `snapshot-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;

  const normalizedSections = normalizeSections(parsedSections, {
    language: 'go',
    doc: 'go-spec',
    version,
    baseUrl: fetchResult.url,
    sourcePolicy: 'excerpt_only',
  });

  // 4. Persist (transaction) with diff-based counting
  const counters: Record<UpsertResult, number> = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
  };

  const transaction = db.transaction(() => {
    queries.upsertSnapshot({
      language: 'go',
      doc: 'go-spec',
      version,
      fetched_at: new Date().toISOString(),
      etag: fetchResult.etag,
      source_url: fetchResult.url,
    });

    for (const section of normalizedSections) {
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
