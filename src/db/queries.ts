import type Database from 'better-sqlite3';
import type { Section, Snapshot, Citation, VersionInfo } from '../types.js';

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

  upsertSection(s: {
    language: string; doc: string; version: string;
    section_id: string; title: string; section_path: string;
    canonical_url: string; excerpt: string; fulltext: string;
    content_hash: string; source_policy: string;
  }): void {
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

    // Note: snippet() is not available in FTS5 content-sync mode.
    // We use the excerpt from the sections table instead.
    const sql = `
      SELECT
        s.language, s.doc, s.version, s.section_id,
        s.title, s.section_path, s.canonical_url,
        s.excerpt, s.source_policy,
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
      excerpt: string; source_policy: string;
      score: number;
    }>;

    return rows.map(r => ({
      language: r.language,
      doc: r.doc,
      version: r.version,
      section_id: r.section_id,
      title: r.title,
      section_path: r.section_path,
      url: r.canonical_url,
      snippet: {
        text: r.excerpt.substring(0, 300),
        start_char: 0,
        end_char: Math.min(r.excerpt.length, 300),
      },
      source_policy: r.source_policy,
      score: r.score,
    }));
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
}
