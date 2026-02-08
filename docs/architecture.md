# langspec-mcp Architecture Guide

プログラミング言語仕様をインデックス化し、MCP (Model Context Protocol) 経由で検索・引用を提供するサーバの内部設計ドキュメント。

---

## 目次

1. [システム概要](#システム概要)
2. [ディレクトリ構成](#ディレクトリ構成)
3. [データモデル](#データモデル)
4. [Ingestionパイプライン](#ingestionパイプライン)
5. [MCPサーバ](#mcpサーバ)
6. [MCPツール一覧](#mcpツール一覧)
7. [データベース設計](#データベース設計)
8. [主要な設計判断](#主要な設計判断)
9. [型定義](#型定義)
10. [設定とビルド](#設定とビルド)

---

## システム概要

langspec-mcp は2つの動作モードを持つ:

```
┌─────────────────────────────────────────────────┐
│  CLI (src/index.ts)                             │
│                                                 │
│  ingest [--language <lang>]   serve             │
│     │                           │               │
│     ▼                           ▼               │
│  Ingestion Pipeline         MCP Server          │
│  (fetch → parse →           (stdio transport)   │
│   normalize → persist)         │                │
│     │                          │                │
│     ▼                          ▼                │
│  ┌──────────────────────────────────┐           │
│  │  SQLite + FTS5                   │           │
│  │  data/langspec.db                │           │
│  └──────────────────────────────────┘           │
└─────────────────────────────────────────────────┘
```

- **ingest**: 言語仕様HTMLを取得→パース→正規化→SQLiteに格納
- **serve**: stdio経由のMCPサーバを起動し、AIクライアントからのツール呼び出しに応答

---

## ディレクトリ構成

```
langspec-mcp/
├── src/
│   ├── index.ts                 # CLIエントリポイント (ingest / serve)
│   ├── server.ts                # MCPサーバ + ツール登録
│   ├── types.ts                 # 型定義 + Zodスキーマ
│   ├── db/
│   │   ├── schema.ts            # DB初期化 + マイグレーション + hashContent()
│   │   └── queries.ts           # DatabaseQueriesクラス + extractRelevantSnippet()
│   ├── ingestion/
│   │   ├── index.ts             # パイプラインオーケストレータ
│   │   ├── fetcher.ts           # HTTP fetch (ETag対応)
│   │   ├── parser.ts            # HTML → ParsedSection[] (cheerio)
│   │   └── normalizer.ts        # ParsedSection → NormalizedSection (excerpt生成, hash計算)
│   └── tools/
│       ├── list-languages.ts    # list_languages ツール
│       ├── list-versions.ts     # list_versions ツール
│       ├── search-spec.ts       # search_spec ツール
│       └── get-section.ts       # get_section ツール
├── data/
│   └── langspec.db              # SQLiteデータベース (gitignore対象)
├── dist/                        # TypeScriptコンパイル出力
├── docs/                        # ドキュメント
├── package.json
├── tsconfig.json
└── CLAUDE.md                    # Claude Code用プロジェクト指示
```

---

## データモデル

### エンティティ関係

```
snapshots (取り込みメタデータ)
  │
  │ 1:N (language, doc, version)
  ▼
sections (仕様セクション)
  │
  │ FTS5トリガーで自動同期
  ▼
fts_sections (全文検索インデックス)
```

### 主要な型

| 型 | 用途 |
|---|------|
| `FetchResult` | HTTP取得結果 (html, etag, url) |
| `ParsedSection` | パーサ出力 (section_id, title, section_path, content, heading_level) |
| `NormalizedSection` | DB格納形式 (excerpt, fulltext, content_hash, source_policy 含む) |
| `Section` | DBから読み出したセクション |
| `Citation` | 検索結果の引用形式 (snippet + score 含む) |
| `Snapshot` | 取り込みスナップショットのメタデータ |

---

## Ingestionパイプライン

`src/ingestion/index.ts` の `ingestGoSpec()` が4段階のパイプラインを実行する:

### Stage 1: Fetch (`fetcher.ts`)

```typescript
fetchGoSpec(): Promise<FetchResult>
```

- `https://go.dev/ref/spec` からHTMLを取得
- ETagヘッダを保存（将来の条件付きリクエスト用）
- User-Agent: `langspec-mcp/1.0`

### Stage 2: Parse (`parser.ts`)

```typescript
parseGoSpec(html: string, baseUrl: string): ParsedSection[]
```

- cheerioでHTML解析
- `h2`, `h3`, `h4` 見出しを走査
- 見出しの階層からsection_pathを構築 (例: `Types > Function types`)
- 各見出しの後続要素から、次の同レベル以上の見出しまでのテキストを収集
- **section_id安定化**: `id`属性がない見出しには `stableId(baseUrl, headingText, index)` でSHA-256ベースのID (`gen-xxxxxxxxxxxx`) を生成

### Stage 3: Normalize (`normalizer.ts`)

```typescript
normalizeSections(sections: ParsedSection[], meta: {...}): NormalizedSection[]
```

- fulltextからexcerptを生成 (最大1200文字、超過時は `...` 付加)
- canonical_urlを構築 (`baseUrl#section_id`)
- content_hashを計算 (SHA-256)
- source_policyを設定 (デフォルト: `excerpt_only`)

### Stage 4: Persist (ingestion/index.ts 内のトランザクション)

- snapshotをupsert
- 各セクションをdiff-based upsert:
  - `content_hash` が既存と一致 → skip (`unchanged`)
  - `content_hash` が不一致 → update (`updated`)
  - 新規 → insert (`inserted`)
- 完了時にサマリログ出力: `"162 inserted, 0 updated, 0 unchanged"`

---

## MCPサーバ

### 起動フロー (`server.ts`)

```typescript
startServer(db: Database.Database): Promise<void>
```

1. `Server` インスタンス作成 (name: `langspec-mcp`, version: `1.0.0`)
2. `ListToolsRequestSchema` ハンドラ登録 — 4ツールのスキーマを返す
3. `CallToolRequestSchema` ハンドラ登録 — ツール名でディスパッチ
4. `StdioServerTransport` で接続開始

### 通信プロトコル

- **トランスポート**: stdio (stdin/stdout でJSON-RPC 2.0)
- **重要制約**: `console.log` 厳禁（stdoutはJSON-RPC通信に占有される）。ログは `console.error` のみ
- **レスポンス形式**: `{ content: [{ type: "text", text: JSON.stringify(data) }] }`

### エラーハンドリング

- Zodバリデーション失敗 → エラーメッセージを `isError: true` で返却
- 未知のツール名 → `"Error: Unknown tool"` を返却
- ツール実行エラー → `error.message` を返却

---

## MCPツール一覧

### `list_languages`

インデックス済みの言語一覧を返す。

| 項目 | 値 |
|------|---|
| 入力 | なし |
| 出力 | `LanguageInfo[]` — language, docs[], notes? |

### `list_versions`

指定言語の利用可能バージョン一覧を返す。

| 項目 | 値 |
|------|---|
| 入力 | `language: string` (必須) |
| 出力 | `VersionInfo[]` — version, fetched_at, source_url |

### `search_spec`

FTS5全文検索でセクションを検索し、引用を返す。

| 項目 | 値 |
|------|---|
| 入力 | `query: string` (必須), `language: string` (必須), `version?: string`, `filters?: { doc?, section_path_prefix?, limit? }` |
| 出力 | `Citation[]` — snippet (クエリマッチ周辺300文字), score (BM25) |

- バージョン未指定時は最新スナップショットを自動選択
- BM25重み: title=10, section_path=5, content=1
- スニペット: `extractRelevantSnippet()` でクエリトークンの最初のマッチ位置を中心に300文字を切り出し

### `get_section`

section_idで特定セクションの詳細を取得。

| 項目 | 値 |
|------|---|
| 入力 | `language: string` (必須), `version: string` (必須), `section_id: string` (必須) |
| 出力 | `SectionResult` — citation + content (excerpt, is_truncated, fulltext_available, fulltext?) |

- `source_policy === 'local_fulltext_ok'` のときのみ `fulltext` を返却
- 現在Go仕様は `excerpt_only` で設定されている

---

## データベース設計

### スキーマ (v1)

```sql
-- 取り込みスナップショット
CREATE TABLE snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  language TEXT NOT NULL,
  doc TEXT NOT NULL,
  version TEXT NOT NULL,        -- 'snapshot-YYYYMMDD' 形式
  fetched_at TEXT NOT NULL,     -- ISO 8601
  etag TEXT,
  source_url TEXT NOT NULL,
  UNIQUE(language, doc, version)
);

-- 仕様セクション
CREATE TABLE sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  language TEXT NOT NULL,
  doc TEXT NOT NULL,
  version TEXT NOT NULL,
  section_id TEXT NOT NULL,      -- HTMLアンカーID or 'gen-xxxx'
  title TEXT NOT NULL,
  section_path TEXT NOT NULL,    -- 'Types > Function types'
  canonical_url TEXT NOT NULL,
  excerpt TEXT NOT NULL,         -- 最大1200文字
  fulltext TEXT NOT NULL,
  content_hash TEXT NOT NULL,    -- SHA-256
  source_policy TEXT NOT NULL DEFAULT 'excerpt_only',
  UNIQUE(language, doc, version, section_id)
);

-- FTS5全文検索 (content-sync mode)
CREATE VIRTUAL TABLE fts_sections USING fts5(
  title, section_path, content,
  content='sections', content_rowid='id',
  tokenize='porter unicode61'
);
```

### FTS5トリガー

sections テーブルの INSERT / UPDATE / DELETE に連動して fts_sections を自動同期:

- **AFTER INSERT**: fts_sectionsにrowを追加
- **AFTER UPDATE**: 旧rowを削除 → 新rowを追加
- **AFTER DELETE**: 旧rowを削除

**注意**: content-sync モードでは `snippet()` 関数が使えないため、snippet抽出はアプリケーション層 (`extractRelevantSnippet()`) で実行している。

### マイグレーション管理

`schema_version` テーブルでバージョン管理。`initializeDatabase()` が起動時に現在バージョンを確認し、未適用マイグレーションを順次適用する。

---

## 主要な設計判断

### 1. stdio トランスポート

MCPの最もシンプルなトランスポート。デーモンプロセスとしてAIクライアント（Claude Desktop等）から起動される。HTTP/SSEトランスポートへの移行はM5で検討。

### 2. FTS5 content-sync mode

- セクションデータの二重管理を避ける
- トリガーによる自動同期で整合性を保証
- トレードオフ: `snippet()` 関数が使えない

### 3. Diff-based re-index

- `content_hash` (SHA-256) で変更検知
- 変更のないセクションはUPDATEをスキップ（FTS5再インデックスも回避）
- 定期的な再ingestionの効率化

### 4. section_id安定化

- HTMLの `id` 属性がある見出し: そのまま使用
- `id` 属性がない見出し: `gen-` + SHA-256(baseUrl + headingText + index) の先頭12文字
- URLやタイトルが変わらない限り同じIDが生成される

### 5. source_policy

- `excerpt_only`: excerptのみ返却（著作権配慮）
- `local_fulltext_ok`: fulltextも返却可能
- 言語/ドキュメントごとに設定可能

---

## 型定義

### Zodスキーマ (`types.ts`)

MCPツール入力のバリデーションにZodを使用:

| スキーマ | 用途 |
|---------|------|
| `ListLanguagesInputSchema` | 空オブジェクト |
| `ListVersionsInputSchema` | `{ language: LanguageEnum }` |
| `SearchSpecInputSchema` | `{ query, language, version?, filters? }` |
| `GetSectionInputSchema` | `{ language, version, section_id }` |

`LanguageEnum` は `['go', 'java', 'rust', 'typescript']` で定義されているが、現在ingestionが実装されているのはGoのみ。

---

## 設定とビルド

### TypeScript設定 (`tsconfig.json`)

| 設定 | 値 | 理由 |
|------|---|------|
| `target` | ES2022 | Node.js 18+ の機能を利用 |
| `module` | Node16 | ESM + `.js` 拡張子のimportを正しく解決 |
| `moduleResolution` | Node16 | 同上 |
| `strict` | true | 型安全性 |

### npm scripts

| コマンド | 説明 |
|---------|------|
| `npm run build` | TypeScriptコンパイル |
| `npm run dev` | watchモードでコンパイル |
| `npm run ingest` | Go仕様の取り込み |
| `npm run serve` | MCPサーバ起動 |

### 依存関係

| パッケージ | バージョン | 用途 |
|-----------|----------|------|
| `@modelcontextprotocol/sdk` | ^1.26.0 | MCPサーバフレームワーク |
| `better-sqlite3` | ^11.8.1 | SQLite3バインディング |
| `cheerio` | ^1.0.0 | HTML解析 |
| `zod` | ^3.24.1 | 入力バリデーション |
