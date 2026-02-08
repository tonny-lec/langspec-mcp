import type Database from 'better-sqlite3';
import { fetchGoSpec } from './fetcher.js';
import { parseGoSpec } from './parser.js';
import { normalizeSections } from './normalizer.js';
import { DatabaseQueries } from '../db/queries.js';

export async function ingestGoSpec(db: Database.Database): Promise<void> {
  console.error('[Ingestion] Starting Go spec ingestion...');

  const queries = new DatabaseQueries(db);

  // 1. Fetch
  const fetchResult = await fetchGoSpec();

  // 2. Parse
  const parsedSections = parseGoSpec(fetchResult.html);

  // 3. Normalize
  const version = `snapshot-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;

  const normalizedSections = normalizeSections(parsedSections, {
    language: 'go',
    doc: 'go-spec',
    version,
    baseUrl: fetchResult.url,
  });

  // 4. Persist (transaction)
  const transaction = db.transaction(() => {
    queries.upsertSnapshot({
      language: 'go',
      doc: 'go-spec',
      version,
      fetched_at: new Date().toISOString(),
      etag: fetchResult.etag,
      source_url: fetchResult.url,
    });

    let count = 0;
    for (const section of normalizedSections) {
      queries.upsertSection(section);
      count++;
    }

    console.error(`[Ingestion] Inserted ${count} sections for version ${version}`);
  });

  transaction();
  console.error('[Ingestion] Completed successfully');
}
