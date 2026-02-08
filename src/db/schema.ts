import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { createLogger } from '../lib/logger.js';

const log = createLogger('DB');

export const EXCERPT_MAX_LENGTH = 1200;

export function initializeDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const row = db.prepare(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  ).get() as { version: number } | undefined;

  const currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    applyV1(db);
  }

  return db;
}

function applyV1(db: Database.Database): void {
  log.info('Applying migration v1: initial schema');

  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      language TEXT NOT NULL,
      doc TEXT NOT NULL,
      version TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      etag TEXT,
      source_url TEXT NOT NULL,
      UNIQUE(language, doc, version)
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_lang_doc
      ON snapshots(language, doc);

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      language TEXT NOT NULL,
      doc TEXT NOT NULL,
      version TEXT NOT NULL,
      section_id TEXT NOT NULL,
      title TEXT NOT NULL,
      section_path TEXT NOT NULL,
      canonical_url TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      fulltext TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      source_policy TEXT NOT NULL DEFAULT 'excerpt_only',
      UNIQUE(language, doc, version, section_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sections_lang_doc_ver
      ON sections(language, doc, version);

    CREATE VIRTUAL TABLE IF NOT EXISTS fts_sections USING fts5(
      title,
      section_path,
      content,
      content='sections',
      content_rowid='id',
      tokenize='porter unicode61'
    );

    CREATE TRIGGER IF NOT EXISTS sections_ai AFTER INSERT ON sections BEGIN
      INSERT INTO fts_sections(rowid, title, section_path, content)
      VALUES (new.id, new.title, new.section_path, new.fulltext);
    END;

    CREATE TRIGGER IF NOT EXISTS sections_ad AFTER DELETE ON sections BEGIN
      INSERT INTO fts_sections(fts_sections, rowid, title, section_path, content)
      VALUES ('delete', old.id, old.title, old.section_path, old.fulltext);
    END;

    CREATE TRIGGER IF NOT EXISTS sections_au AFTER UPDATE ON sections BEGIN
      INSERT INTO fts_sections(fts_sections, rowid, title, section_path, content)
      VALUES ('delete', old.id, old.title, old.section_path, old.fulltext);
      INSERT INTO fts_sections(rowid, title, section_path, content)
      VALUES (new.id, new.title, new.section_path, new.fulltext);
    END;

    INSERT OR IGNORE INTO schema_version (version) VALUES (1);
  `);

  log.info('Migration v1 applied');
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
