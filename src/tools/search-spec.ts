import type Database from 'better-sqlite3';
import { DatabaseQueries } from '../db/queries.js';
import type { Citation } from '../types.js';

export function searchSpec(
  db: Database.Database,
  params: {
    query: string;
    language: string;
    version?: string;
    filters?: {
      doc?: string;
      section_path_prefix?: string;
      limit?: number;
    };
  },
): Citation[] {
  const queries = new DatabaseQueries(db);

  // If no version, use latest snapshot
  let version = params.version;
  if (!version) {
    const docName = params.filters?.doc ?? 'go-spec';
    const latest = queries.getLatestSnapshot(params.language, docName);
    if (!latest) {
      throw new Error(`No indexed data for language: ${params.language}`);
    }
    version = latest.version;
  }

  return queries.searchSections({
    query: params.query,
    language: params.language,
    version,
    doc: params.filters?.doc,
    sectionPathPrefix: params.filters?.section_path_prefix,
    limit: params.filters?.limit ?? 10,
  });
}
