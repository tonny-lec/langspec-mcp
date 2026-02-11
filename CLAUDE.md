# Language Spec MCP Server

## Overview
プログラミング言語仕様をインデックス化し、MCP経由で検索・引用を提供するサーバ。
- **M1完了**: Go仕様 + stdio MCPサーバ + SQLite/FTS5
- **M2完了**: Citation precision (diff re-index, source_policy, snippet, section_id stability)
- **M3完了**: build_learning_plan tool (週間学習プラン自動生成)
- **M4完了**: 多言語対応 (Go, Java, Rust, TypeScript)
- **M5完了**: NFR堅牢化 (構造化ログ, retry/timeout, ETag, disk cache, 部分失敗回復, adaptive rate limiting)
- **M6完了**: Vitest ドキュメント対応 + 汎用IT技術ドキュメント取り込み (再帰ディレクトリ探索, excludePaths, urlSuffix, chapterPattern汎化)
- **M7完了**: 外部設定ファイル (`data/sources.json`) + DocSource 統一モデル (コード変更不要で新ドキュメント追加可能)
- ~3,900セクション indexed (Go 162, Java 575, Rust 1401, TypeScript 178, Vitest ~1587)、5 MCP tools稼働、142+ tests

## Tech Stack
- TypeScript (ES modules, `"type": "module"`, `"module": "Node16"`)
- `@modelcontextprotocol/sdk` v1.26.0 (Server + setRequestHandler)
- `better-sqlite3` + FTS5
- `cheerio` v1.x (HTML解析 — `Element`型は未export、`elem.tagName`直接参照)
- `zod` (入力バリデーション)
- stdio トランスポート

## Critical Rules
- **`console.log` 厳禁** — stdoutはJSON-RPC通信専用。ログは構造化ロガー (`createLogger`) 経由で stderr 出力
- **Tool結果は `{ content: [{ type: "text", text: JSON.stringify(data) }] }` 形式**
- **FTS5同期はトリガーで自動化** — INSERT/UPDATE/DELETEで fts_sections が自動更新
- **差分更新は `content_hash` 比較** — upsert前にハッシュ比較、変更時のみ更新

## File Structure
```
data/
├── sources.json         # External doc source config (add entries here, no rebuild needed)
├── langspec.db          # SQLite database
└── cache/               # ETag disk cache
src/
├── index.ts             # CLI: ingest / serve (--language flag, LOG_LEVEL)
├── server.ts            # MCP Server + tool registration
├── types.ts             # TypeScript types + Zod schemas (FetchOutcome etc.)
├── config/
│   ├── languages.ts     # LanguageConfig registry (lazy-loads from sources.json)
│   ├── doc-source.ts    # DocSource type + Zod schema + resolveDocSource()
│   └── source-loader.ts # loadSources() — reads & validates sources.json
├── db/
│   ├── schema.ts        # DB init + migrations
│   └── queries.ts       # DatabaseQueries + extractRelevantSnippet()
├── ingestion/
│   ├── index.ts         # Pipeline orchestrator (diff report, partial failure)
│   ├── fetcher.ts       # HTTP fetch (retry, cache, ETag, adaptive rate limit)
│   ├── parser.ts        # HTML/Markdown → Section[] (cheerio, stableId)
│   └── normalizer.ts    # Normalize + sourcePolicy + excerpt
├── lib/
│   ├── logger.ts        # Structured JSON logger (LOG_LEVEL, stderr)
│   ├── retry.ts         # withRetry + FetchError + parseRetryAfter
│   └── cache.ts         # DiskCache (ETag meta + content files)
└── tools/
    ├── list-languages.ts
    ├── list-versions.ts
    ├── search-spec.ts
    ├── get-section.ts
    └── build-learning-plan.ts
```

## Key Patterns

### External Config (M7)
- ドキュメントソースは `data/sources.json` で定義（コード修正・再ビルド不要）
- `DocSource` 統一モデル: `url` or `github` を指定、`fetchStrategy` は自動推論
- `resolveDocSource()`: DocSource → DocConfig 変換（純粋関数）
- `loadSources()`: JSON 読み込み → Zod バリデーション → LanguageConfig[] 生成
- 新ソース追加: `data/sources.json` にエントリ追加 → `npm run ingest -- --language <name>`

### Diff-based Re-index
- `content_hash` (SHA-256) で各セクションの変更を検出
- upsert結果: `inserted` / `updated` / `unchanged` で差分レポート出力

### Section ID Stability
- HTML見出しに `id` 属性がある場合はそのまま使用
- `id` 無しの見出しには `stableId` (テキストベースのハッシュ) でフォールバック

### Snippet Extraction
- FTS5 content-sync mode では `snippet()` 関数が使用不可
- `extractRelevantSnippet()`: クエリトークンの初出位置を中心にウィンドウ抽出

### Source Policy
- `normalizer.ts` で言語ごとの正規化ルール (URL構築、メタデータ付与) を管理

### Structured Logging (M5)
- `createLogger(component)` で JSON Lines を stderr 出力
- `LOG_LEVEL` 環境変数: `debug` / `info` (default) / `warn` / `error`
- `process.stderr.write()` で直接出力（`console.error` は使用しない）

### Retry + Timeout (M5)
- `withRetry(fn, opts)`: maxRetries=3, exponential backoff + ±25% jitter
- `AbortSignal.timeout(30_000)` で全 fetch に 30 秒タイムアウト
- `FetchError` クラス: url, status, retryAfter プロパティ
- Retryable: 429, 500-599, TypeError (DNS/接続エラー)

### ETag + Disk Cache (M5)
- `fetchUrl()` が `If-None-Match` ヘッダーで条件付きリクエスト
- 304 応答時はパース省略（single-html の場合は全体スキップ）
- `DiskCache`: `data/cache/{lang}/{doc}/{url-sha256-16hex}.html` + `.meta.json`
- キャッシュ ETag でページ単位の条件付きリクエスト

### Partial Failure Recovery (M5)
- `FetchOutcome` 型: `{ results, errors, summary: {total, fetched, cached, failed} }`
- マルチページ取得で一部失敗しても残りを処理継続
- 全失敗のみエラー throw、部分失敗は warn ログ + 処理継続

### Adaptive Rate Limiting (M5)
- 429 受信時にバッチ内の `delayMs` を動的に増加
- `Retry-After` ヘッダー値を使用、無ければ倍増（上限 10 秒）

## Documentation
`docs/` にアーキテクチャ解説ドキュメント（日本語）を格納。初心者向けに設計〜実装を7章構成で解説。
- `docs/README.md` — 目次・読み方ガイド・全体図
- `docs/01-overview.md` — MCP概要と2つのコマンド
- `docs/02-typescript-basics.md` — TS プロジェクト構成・ビルド
- `docs/03-config.md` — 言語設定レジストリ・FetchStrategy
- `docs/04-ingestion-pipeline.md` — 取り込みパイプライン全工程
- `docs/05-database.md` — SQLite + FTS5 設計
- `docs/06-mcp-server.md` — MCPサーバ・ツール実装
- `docs/07-reliability.md` — ログ・リトライ・キャッシュ・レート制限

## Build & Run
```bash
npm run build                              # TypeScript compile
npm run ingest                             # Fetch & index Go spec
npm run ingest -- --language go            # Language指定
npm run ingest -- --language all           # 全言語
npm run serve                              # Start MCP server (stdio)
LOG_LEVEL=debug npm run ingest -- --language go  # Debug ログ出力
```

## Commit Convention
- feat: / fix: / refactor: / docs: / test: prefix
- 日本語OK、ただしコミットメッセージは英語

## Git Workflow

### Git Flow ブランチモデル
- **`main`** — 本番リリース用。直接コミット禁止
- **`develop`** — 統合ブランチ。feature ブランチのマージ先
- **`feature/<issue番号>-<slug>`** — 機能開発。develop から分岐、develop へマージ
- **`release/<version>`** — リリース準備。develop → main へマージ
- **`hotfix/<slug>`** — 緊急修正。main から分岐、main + develop へマージ

### 開発フロー
1. **Plan mode** で計画立案 → タスクごとに GitHub Issue を作成 (`github-issues` スキル or `refine-issue` エージェント)
2. **Issue ごとに feature ブランチ作成** — `git-flow-manager` エージェントを使用
3. **実装 → テスト → コミット** — develop へ PR 作成
4. **PR マージ** — squash or merge commit

### スキル/エージェント使い分け
- **`git-advanced-workflows` スキル** — rebase, cherry-pick, bisect, worktree, reflog 等の高度なGit操作時に参照
- **`git-flow-manager` エージェント** — feature/release/hotfix ブランチの作成・マージ・PR生成時に使用 (Task tool, subagent_type=git-flow-manager)
- **`github-issues` スキル** — Issue 作成・更新・ラベル管理
- **`refine-issue` エージェント** — 要件を AC/技術考慮/エッジケース/NFR に整理

### トリガー
- PreToolUse フック (`git-skill-reminder.sh`) が git コマンドを検出し、適切なスキル/エージェントの使用をリマインド
- ブランチ作成・マージ → git-flow-manager
- rebase/cherry-pick/bisect/stash/reflog → git-advanced-workflows
