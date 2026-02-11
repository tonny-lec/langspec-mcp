import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type Database from 'better-sqlite3';
import { initializeDatabase } from '../src/db/schema.js';
import { DatabaseQueries } from '../src/db/queries.js';
import { ingestSpec } from '../src/ingestion/index.js';

describe('Vitest ingestion (integration)', { timeout: 120_000 }, () => {
  let db: Database.Database;

  beforeAll(async () => {
    db = initializeDatabase(':memory:');
    await ingestSpec(db, 'vitest');
  }, 120_000);

  afterAll(() => {
    db?.close();
  });

  it('ingests sections from vitest docs', () => {
    const queries = new DatabaseQueries(db);
    const count = db.prepare('SELECT COUNT(*) as cnt FROM sections WHERE language = ?').get('vitest') as { cnt: number };
    expect(count.cnt).toBeGreaterThan(10);
  });

  it('includes sections from subdirectories', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM sections WHERE language = 'vitest' AND canonical_url LIKE '%/guide/%'"
    ).get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });

  it('builds correct canonical URLs (no .html suffix)', () => {
    const rows = db.prepare(
      "SELECT canonical_url FROM sections WHERE language = 'vitest' LIMIT 20"
    ).all() as { canonical_url: string }[];

    for (const row of rows) {
      expect(row.canonical_url).toMatch(/^https:\/\/vitest\.dev\//);
      // VitePress clean URLs: no .html before #
      expect(row.canonical_url).not.toMatch(/\.html#/);
    }
  });

  it('search finds vitest-specific content', () => {
    const queries = new DatabaseQueries(db);
    const results = queries.searchSections({ query: 'mock', language: 'vitest', limit: 10 });
    expect(results.length).toBeGreaterThan(0);
  });
});
