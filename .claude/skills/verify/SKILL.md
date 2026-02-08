---
name: verify
description: Full project health check - build, ingest, DB counts, console.log scan
user-invocable: true
allowed-tools: Bash, Read, Grep
---

# Project Verification

Run a full health check on the language spec MCP server.

## Steps

1. **Build**: Run `npm run build` and verify no errors
2. **Ingest**: Run `npm run ingest` and verify success
3. **DB Integrity**: Query SQLite to compare row counts
   - `SELECT COUNT(*) FROM sections;`
   - `SELECT COUNT(*) FROM fts_sections_docsize;` (FTS5 content-sync tables don't support direct COUNT — use internal docsize table)
   - Both counts must match
   - Use: `node -e "import Database from 'better-sqlite3'; const db = new Database('data/langspec.db'); ..."`
4. **console.log scan**: Use Grep to search `src/**/*.ts` for `console.log` — must find zero matches
5. **Report**: Output a summary table:
   - Build: pass/fail
   - Ingest: pass/fail (with inserted/updated/unchanged)
   - Sections count / FTS count / match status
   - console.log violations: count (0 = pass)
