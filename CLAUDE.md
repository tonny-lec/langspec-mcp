# Language Spec MCP Server

## Overview
プログラミング言語仕様をインデックス化し、MCP経由で検索・引用を提供するサーバ。
Milestone 1: Go仕様 + stdio MCPサーバ + SQLite/FTS5。

## Tech Stack
- TypeScript (ES modules, `"type": "module"`)
- `@modelcontextprotocol/sdk` v1.26.0 (Server + setRequestHandler)
- `better-sqlite3` + FTS5
- `cheerio` (HTML解析)
- `zod` (入力バリデーション)
- stdio トランスポート

## Critical Rules
- **`console.log` 厳禁** — stdio MCPサーバではstdoutがJSON-RPC通信に使われる。ログは必ず `console.error` を使う
- **Tool結果は `{ content: [{ type: "text", text: JSON.stringify(data) }] }` 形式**
- **FTS5同期はトリガーで自動化** — sections テーブルへのINSERT/UPDATE/DELETEで fts_sections が自動更新される

## File Structure
```
src/
├── index.ts             # CLI: ingest / serve
├── server.ts            # MCP Server + tool registration
├── types.ts             # TypeScript types + Zod schemas
├── db/
│   ├── schema.ts        # DB init + migrations
│   └── queries.ts       # Query methods (DatabaseQueries class)
├── ingestion/
│   ├── index.ts         # Pipeline orchestrator
│   ├── fetcher.ts       # HTTP fetch with ETag
│   ├── parser.ts        # HTML → Section[] (cheerio)
│   └── normalizer.ts    # Normalize + excerpt generation
└── tools/
    ├── list-languages.ts
    ├── list-versions.ts
    ├── search-spec.ts
    └── get-section.ts
```

## Key Patterns
- DB path: `data/langspec.db` (relative to project root)
- Version format: `snapshot-YYYYMMDD`
- Excerpt max: 1200 chars
- FTS5 BM25 weights: title=10, section_path=5, content=1
- Citation format: language, doc, version, section_id, title, section_path, url, snippet

## Build & Run
```bash
npm run build          # TypeScript compile
npm run ingest         # Fetch & index Go spec
npm run serve          # Start MCP server (stdio)
```

## Commit Convention
- feat: / fix: / refactor: / docs: / test: prefix
- 日本語OK、ただしコミットメッセージは英語
