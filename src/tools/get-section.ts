import type Database from 'better-sqlite3';
import { DatabaseQueries } from '../db/queries.js';
import type { Citation } from '../types.js';

export interface SectionResult {
  citation: Citation;
  content: {
    excerpt: string;
    is_truncated: boolean;
    fulltext_available: boolean;
  };
}

export function getSection(
  db: Database.Database,
  params: { language: string; version: string; section_id: string },
): SectionResult {
  const queries = new DatabaseQueries(db);
  const section = queries.getSection(params.language, params.version, params.section_id);

  if (!section) {
    throw new Error(
      `Section not found: ${params.language}/${params.version}/${params.section_id}`
    );
  }

  return {
    citation: {
      language: section.language,
      doc: section.doc,
      version: section.version,
      section_id: section.section_id,
      title: section.title,
      section_path: section.section_path,
      url: section.canonical_url,
      snippet: {
        text: section.excerpt,
        start_char: 0,
        end_char: section.excerpt.length,
      },
      source_policy: section.source_policy,
    },
    content: {
      excerpt: section.excerpt,
      is_truncated: section.fulltext.length > section.excerpt.length,
      fulltext_available: section.source_policy === 'local_fulltext_ok',
    },
  };
}
