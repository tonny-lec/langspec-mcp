# Language Spec MCP Server

## Overview
プログラミング言語仕様をインデックス化し、MCP経由で検索・引用を提供するサーバ。
- **M1完了**: Go仕様 + stdio MCPサーバ + SQLite/FTS5
- **M2完了**: Citation precision (diff re-index, source_policy, snippet, section_id stability)
- **M3完了**: build_learning_plan tool (週間学習プラン自動生成)
- 162セクション indexed、5 MCP tools稼働
- **次**: M4 (多言語対応)

## Tech Stack
- TypeScript (ES modules, `"type": "module"`, `"module": "Node16"`)
- `@modelcontextprotocol/sdk` v1.26.0 (Server + setRequestHandler)
- `better-sqlite3` + FTS5
- `cheerio` v1.x (HTML解析 — `Element`型は未export、`elem.tagName`直接参照)
- `zod` (入力バリデーション)
- stdio トランスポート

## Critical Rules
- **`console.log` 厳禁** — stdoutはJSON-RPC通信専用。ログは `console.error` のみ
- **Tool結果は `{ content: [{ type: "text", text: JSON.stringify(data) }] }` 形式**
- **FTS5同期はトリガーで自動化** — INSERT/UPDATE/DELETEで fts_sections が自動更新
- **差分更新は `content_hash` 比較** — upsert前にハッシュ比較、変更時のみ更新

## File Structure
```
src/
├── index.ts             # CLI: ingest / serve (--language flag)
├── server.ts            # MCP Server + tool registration
├── types.ts             # TypeScript types + Zod schemas
├── db/
│   ├── schema.ts        # DB init + migrations
│   └── queries.ts       # DatabaseQueries + extractRelevantSnippet()
├── ingestion/
│   ├── index.ts         # Pipeline orchestrator (diff report)
│   ├── fetcher.ts       # HTTP fetch with ETag
│   ├── parser.ts        # HTML → Section[] (cheerio, stableId fallback)
│   └── normalizer.ts    # Normalize + sourcePolicy + excerpt
└── tools/
    ├── list-languages.ts
    ├── list-versions.ts
    ├── search-spec.ts
    ├── get-section.ts
    └── build-learning-plan.ts
```

## Key Patterns

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

## Build & Run
```bash
npm run build                    # TypeScript compile
npm run ingest                   # Fetch & index Go spec
npm run ingest -- --language go  # Language指定
npm run serve                    # Start MCP server (stdio)
```

## Roadmap
- **M4**: Java (JLS/JVMS), Rust, TypeScript 言語追加
- **M5**: Non-functional (caching, rate limiting, observability)

## Commit Convention
- feat: / fix: / refactor: / docs: / test: prefix
- 日本語OK、ただしコミットメッセージは英語

## Git Workflow

### スキル/エージェント使い分け
- **`git-advanced-workflows` スキル** — rebase, cherry-pick, bisect, worktree, reflog 等の高度なGit操作時に参照
- **`git-flow-manager` エージェント** — feature/release/hotfix ブランチの作成・マージ・PR生成時に使用 (Task tool, subagent_type=git-flow-manager)

### トリガー
- PreToolUse フック (`git-skill-reminder.sh`) が git コマンドを検出し、適切なスキル/エージェントの使用をリマインド
- ブランチ作成・マージ → git-flow-manager
- rebase/cherry-pick/bisect/stash/reflog → git-advanced-workflows
