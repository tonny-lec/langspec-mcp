import type Database from 'better-sqlite3';
import type { Section, Snapshot, Citation, VersionInfo } from '../types.js';

export type UpsertResult = 'inserted' | 'updated' | 'unchanged';

export class DatabaseQueries {
  constructor(private db: Database.Database) {}

  // ========================================
  // Snapshot Operations
  // ========================================

  upsertSnapshot(s: Omit<Snapshot, 'id'>): void {
    this.db.prepare(`
      INSERT INTO snapshots (language, doc, version, fetched_at, etag, source_url)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(language, doc, version) DO UPDATE SET
        fetched_at = excluded.fetched_at,
        etag = excluded.etag
    `).run(s.language, s.doc, s.version, s.fetched_at, s.etag, s.source_url);
  }

  getLatestSnapshot(language: string, doc: string): Snapshot | undefined {
    return this.db.prepare(`
      SELECT * FROM snapshots
      WHERE language = ? AND doc = ?
      ORDER BY fetched_at DESC LIMIT 1
    `).get(language, doc) as Snapshot | undefined;
  }

  listVersions(language: string): VersionInfo[] {
    return this.db.prepare(`
      SELECT version, fetched_at, source_url
      FROM snapshots
      WHERE language = ?
      ORDER BY fetched_at DESC
    `).all(language) as VersionInfo[];
  }

  // ========================================
  // Section Operations
  // ========================================

  getSectionHash(language: string, doc: string, version: string, sectionId: string): string | undefined {
    const row = this.db.prepare(`
      SELECT content_hash FROM sections
      WHERE language = ? AND doc = ? AND version = ? AND section_id = ?
    `).get(language, doc, version, sectionId) as { content_hash: string } | undefined;
    return row?.content_hash;
  }

  upsertSection(s: {
    language: string; doc: string; version: string;
    section_id: string; title: string; section_path: string;
    canonical_url: string; excerpt: string; fulltext: string;
    content_hash: string; source_policy: string;
  }): UpsertResult {
    const existingHash = this.getSectionHash(s.language, s.doc, s.version, s.section_id);

    if (existingHash === s.content_hash) {
      return 'unchanged';
    }

    this.db.prepare(`
      INSERT INTO sections (
        language, doc, version, section_id, title, section_path,
        canonical_url, excerpt, fulltext, content_hash, source_policy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(language, doc, version, section_id) DO UPDATE SET
        title = excluded.title,
        section_path = excluded.section_path,
        canonical_url = excluded.canonical_url,
        excerpt = excluded.excerpt,
        fulltext = excluded.fulltext,
        content_hash = excluded.content_hash,
        source_policy = excluded.source_policy
    `).run(
      s.language, s.doc, s.version, s.section_id, s.title, s.section_path,
      s.canonical_url, s.excerpt, s.fulltext, s.content_hash, s.source_policy,
    );

    return existingHash === undefined ? 'inserted' : 'updated';
  }

  getSection(language: string, version: string, sectionId: string): Section | undefined {
    return this.db.prepare(`
      SELECT * FROM sections
      WHERE language = ? AND version = ? AND section_id = ?
    `).get(language, version, sectionId) as Section | undefined;
  }

  // ========================================
  // FTS5 Search
  // ========================================

  searchSections(params: {
    query: string;
    language: string;
    version?: string;
    doc?: string;
    sectionPathPrefix?: string;
    limit: number;
  }): Citation[] {
    const conditions: string[] = ['fts_sections MATCH ?', 's.language = ?'];
    const args: (string | number)[] = [params.query, params.language];

    if (params.version) {
      conditions.push('s.version = ?');
      args.push(params.version);
    }
    if (params.doc) {
      conditions.push('s.doc = ?');
      args.push(params.doc);
    }
    if (params.sectionPathPrefix) {
      conditions.push('s.section_path LIKE ?');
      args.push(`${params.sectionPathPrefix}%`);
    }

    args.push(params.limit);

    const sql = `
      SELECT
        s.language, s.doc, s.version, s.section_id,
        s.title, s.section_path, s.canonical_url,
        s.excerpt, s.fulltext, s.source_policy,
        bm25(fts_sections, 10.0, 5.0, 1.0) as score
      FROM fts_sections
      JOIN sections s ON s.id = fts_sections.rowid
      WHERE ${conditions.join(' AND ')}
      ORDER BY score
      LIMIT ?
    `;

    const rows = this.db.prepare(sql).all(...args) as Array<{
      language: string; doc: string; version: string; section_id: string;
      title: string; section_path: string; canonical_url: string;
      excerpt: string; fulltext: string; source_policy: string;
      score: number;
    }>;

    return rows.map(r => {
      const snippet = extractRelevantSnippet(r.fulltext || r.excerpt, params.query);
      return {
        language: r.language,
        doc: r.doc,
        version: r.version,
        section_id: r.section_id,
        title: r.title,
        section_path: r.section_path,
        url: r.canonical_url,
        snippet,
        source_policy: r.source_policy,
        score: r.score,
      };
    });
  }

  // ========================================
  // Language/Doc Metadata
  // ========================================

  listAvailableLanguages(): Array<{ language: string; doc: string }> {
    return this.db.prepare(`
      SELECT DISTINCT language, doc
      FROM snapshots
      ORDER BY language, doc
    `).all() as Array<{ language: string; doc: string }>;
  }

  // ========================================
  // Learning Plan Queries
  // ========================================

  getAllSectionsForPlan(language: string, version?: string): {
    version: string;
    sections: Array<{
      section_id: string;
      title: string;
      section_path: string;
      canonical_url: string;
      fulltext_length: number;
    }>;
  } {
    // Resolve version if not specified
    let resolvedVersion = version;
    if (!resolvedVersion) {
      const latest = this.getLatestSnapshot(language, `${language}-spec`);
      if (!latest) {
        throw new Error(`No indexed data for language: ${language}`);
      }
      resolvedVersion = latest.version;
    }

    const sections = this.db.prepare(`
      SELECT section_id, title, section_path, canonical_url, length(fulltext) as fulltext_length
      FROM sections
      WHERE language = ? AND version = ?
      ORDER BY id ASC
    `).all(language, resolvedVersion) as Array<{
      section_id: string;
      title: string;
      section_path: string;
      canonical_url: string;
      fulltext_length: number;
    }>;

    return { version: resolvedVersion, sections };
  }
}

// ========================================
// Snippet Extraction Helper
// ========================================

export function extractRelevantSnippet(
  text: string,
  query: string,
  maxLen: number = 300,
): { text: string; start_char: number; end_char: number } {
  if (text.length <= maxLen) {
    return { text, start_char: 0, end_char: text.length };
  }

  // Tokenize query: split on whitespace and remove FTS5 operators
  const tokens = query
    .split(/\s+/)
    .filter(t => t.length > 0 && !['AND', 'OR', 'NOT', 'NEAR'].includes(t.toUpperCase()))
    .map(t => t.replace(/[*"()]/g, ''))
    .filter(t => t.length > 0);

  // Find the earliest match position in the text
  const lowerText = text.toLowerCase();
  let bestPos = -1;

  for (const token of tokens) {
    const pos = lowerText.indexOf(token.toLowerCase());
    if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
      bestPos = pos;
    }
  }

  // No match found — fall back to start
  if (bestPos === -1) {
    return {
      text: text.substring(0, maxLen) + '...',
      start_char: 0,
      end_char: maxLen,
    };
  }

  // Center the window around the match
  const half = Math.floor(maxLen / 2);
  let start = Math.max(0, bestPos - half);
  let end = start + maxLen;

  if (end > text.length) {
    end = text.length;
    start = Math.max(0, end - maxLen);
  }

  const snippetText = (start > 0 ? '...' : '') +
    text.substring(start, end) +
    (end < text.length ? '...' : '');

  return { text: snippetText, start_char: start, end_char: end };
}
