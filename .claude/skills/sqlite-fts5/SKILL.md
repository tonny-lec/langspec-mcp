---
name: sqlite-fts5
description: SQLite FTS5 full-text search patterns with better-sqlite3
---

# SQLite FTS5 Patterns (better-sqlite3)

## Initialization
```typescript
import Database from 'better-sqlite3';

const db = new Database('path/to/db.sqlite');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
```

## FTS5 Table with Content Sync
```sql
-- Main table
CREATE TABLE sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  section_path TEXT NOT NULL,
  fulltext TEXT NOT NULL
);

-- FTS5 virtual table (content sync mode)
CREATE VIRTUAL TABLE fts_sections USING fts5(
  title, section_path, content,
  content='sections', content_rowid='id',
  tokenize='porter unicode61'
);

-- Sync triggers (REQUIRED for content sync)
CREATE TRIGGER sections_ai AFTER INSERT ON sections BEGIN
  INSERT INTO fts_sections(rowid, title, section_path, content)
  VALUES (new.id, new.title, new.section_path, new.fulltext);
END;

CREATE TRIGGER sections_ad AFTER DELETE ON sections BEGIN
  INSERT INTO fts_sections(fts_sections, rowid, title, section_path, content)
  VALUES ('delete', old.id, old.title, old.section_path, old.fulltext);
END;

CREATE TRIGGER sections_au AFTER UPDATE ON sections BEGIN
  INSERT INTO fts_sections(fts_sections, rowid, title, section_path, content)
  VALUES ('delete', old.id, old.title, old.section_path, old.fulltext);
  INSERT INTO fts_sections(rowid, title, section_path, content)
  VALUES (new.id, new.title, new.section_path, new.fulltext);
END;
```

## BM25 Search with Ranking
```sql
SELECT s.*, bm25(fts_sections, 10.0, 5.0, 1.0) as score
FROM fts_sections
JOIN sections s ON s.id = fts_sections.rowid
WHERE fts_sections MATCH ?
ORDER BY score
LIMIT ?;
```
- BM25 weights: (title=10, section_path=5, content=1)
- Lower score = better match (negative values)

## Snippet Generation

### `snippet()` Limitation in Content-Sync Mode
**`snippet()` does NOT work with content-sync (`content=`) FTS5 tables.**
It returns empty strings because the FTS table doesn't store actual content.

### Alternative: `extractRelevantSnippet()`
Instead, extract snippets from the source `sections` table:
```typescript
function extractRelevantSnippet(fulltext: string, query: string, maxLen = 1200): string {
  // 1. Tokenize query into words
  // 2. Find first matching token position in fulltext
  // 3. Center a window of maxLen chars around match position
  // 4. Trim to word boundaries, add ellipsis if truncated
}
```
- Query tokens are matched case-insensitively
- Window is centered on the first match, not fixed at start
- Falls back to first `maxLen` chars if no token matches

## Transactions for Bulk Insert
```typescript
const insert = db.prepare('INSERT INTO sections ...');
const tx = db.transaction((rows) => {
  for (const row of rows) insert.run(row);
});
tx(allRows); // Atomic
```
