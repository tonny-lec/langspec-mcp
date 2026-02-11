# Language Spec MCP Server

## Overview
プログラミング言語仕様をインデックス化し、MCP経由で検索・引用を提供するサーバ。
- **M1〜M5完了**: Go/Java/Rust/TypeScript仕様 + SQLite/FTS5 + 構造化ログ/retry/cache/rate limiting
- **M6完了**: Vitest ドキュメント対応 + 汎用IT技術ドキュメント取り込み
- **M7完了**: 外部設定ファイル (`data/sources.json`) — コード変更不要で新ドキュメント追加可能
- ~3,900セクション indexed、5 MCP tools稼働、142+ tests

## Tech Stack
- TypeScript (ES modules, `"type": "module"`, `"module": "Node16"`)
- `@modelcontextprotocol/sdk` v1.26.0 + `better-sqlite3` (FTS5) + `cheerio` v1.x + `zod`
- stdio トランスポート

## Critical Rules
- **`console.log` 厳禁** — stdoutはJSON-RPC通信専用。ログは `createLogger()` 経由で stderr
- **Tool結果は `{ content: [{ type: "text", text: JSON.stringify(data) }] }` 形式**
- **FTS5同期はトリガーで自動化** — INSERT/UPDATE/DELETEで fts_sections が自動更新
- **差分更新は `content_hash` 比較** — upsert前にハッシュ比較、変更時のみ更新

## File Structure
```
data/sources.json              # Doc source config (add entries here, no rebuild needed)
src/
├── index.ts                   # CLI: ingest / serve
├── server.ts                  # MCP Server + tool registration
├── types.ts                   # Types + Zod schemas
├── config/
│   ├── languages.ts           # LanguageConfig registry (lazy-loads from sources.json)
│   ├── doc-source.ts          # DocSource type + Zod + resolveDocSource()
│   └── source-loader.ts       # loadSources() — reads & validates sources.json
├── db/{schema,queries}.ts     # DB init + migrations, queries + snippet extraction
├── ingestion/
│   ├── index.ts               # Pipeline orchestrator (diff report, partial failure)
│   ├── fetcher.ts             # HTTP fetch (retry, cache, ETag, adaptive rate limit)
│   ├── parser.ts              # HTML/Markdown → Section[]
│   └── normalizer.ts          # Normalize + sourcePolicy + excerpt
├── lib/{logger,retry,cache}.ts  # Structured logger, withRetry, DiskCache
└── tools/                     # list-languages, list-versions, search-spec, get-section, build-learning-plan
```

## Key Patterns
- **External Config**: `data/sources.json` でソース定義 → `fetchStrategy` 自動推論 → 詳細は [docs/03-config.md](docs/03-config.md)
- **Diff Re-index**: `content_hash` (SHA-256) で変更検出、`inserted`/`updated`/`unchanged` レポート
- **Section ID**: HTML見出しの `id` 属性優先、無ければ `stableId` (テキストハッシュ) フォールバック
- **Snippet**: FTS5 `snippet()` 使用不可のため `extractRelevantSnippet()` でクエリトークン中心抽出
- **Source Policy**: `excerpt_only` (著作権保護) / `local_fulltext_ok` (OSS全文提供)
- **M5 信頼性パターン**: 構造化ログ, retry/timeout, ETag/disk cache, 部分失敗回復, adaptive rate limiting → 詳細は [docs/07-reliability.md](docs/07-reliability.md)

## Build & Run
```bash
npm run build                              # TypeScript compile
npm run ingest -- --language go            # Language指定 ingest
npm run ingest -- --language all           # 全言語 ingest
npm run serve                              # Start MCP server (stdio)
LOG_LEVEL=debug npm run ingest -- --language go  # Debug ログ出力
```

## Documentation
アーキテクチャ解説は [docs/README.md](docs/README.md) を参照（7章構成、日本語）。

## Commit Convention
- feat: / fix: / refactor: / docs: / test: prefix
- 日本語OK、ただしコミットメッセージは英語

## Git Workflow
- **Git Flow**: `main`(本番) / `develop`(統合) / `feature/` / `release/` / `hotfix/`
- **開発フロー**: Plan mode → Issue作成 → feature branch → PR to develop
- 詳細（スキル/エージェント使い分け、トリガー）は [docs/git-workflow.md](docs/git-workflow.md) を参照
