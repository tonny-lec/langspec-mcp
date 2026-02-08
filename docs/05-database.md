# 05: SQLite + FTS5 データベース設計

## このドキュメントで学ぶこと

- SQLiteを選んだ理由
- テーブル設計（snapshots, sections, fts_sections）
- FTS5全文検索インデックスの仕組み
- トリガーによるインデックス自動同期
- マイグレーション（スキーマバージョン管理）

## なぜSQLiteか

| 比較項目 | SQLite | PostgreSQL/MySQL |
|---------|--------|-----------------|
| セットアップ | 不要（ファイル1つ） | サーバのインストール・起動が必要 |
| 運用 | なし | バックアップ、監視、アップデート |
| 適した規模 | 個人〜小規模 | 中〜大規模 |
| 全文検索 | FTS5（組み込み） | 別途設定が必要 |

langspec-mcp は個人の開発マシン上で動くツールです。データベースサーバを別途立てる必要がなく、`data/langspec.db` という1つのファイルだけで完結するSQLiteが最適です。

## テーブル設計

```
┌──────────────┐       ┌──────────────────┐       ┌─────────────────┐
│  snapshots   │       │    sections      │       │  fts_sections   │
│──────────────│       │──────────────────│       │  (FTS5仮想TBL)  │
│ id           │       │ id               │       │─────────────────│
│ language     │       │ language         │──────>│ rowid (=id)     │
│ doc          │       │ doc              │       │ title           │
│ version      │       │ version          │       │ section_path    │
│ fetched_at   │       │ section_id       │       │ content         │
│ etag         │       │ title            │       └─────────────────┘
│ source_url   │       │ section_path     │           FTS5が自動的に
└──────────────┘       │ canonical_url    │           転置インデックスを
  いつ取得したか         │ excerpt          │           構築・管理
                       │ fulltext         │
                       │ content_hash     │
                       │ source_policy    │
                       └──────────────────┘
```

**対応コード**: `src/db/schema.ts`

### `snapshots` テーブル — 取得メタデータ

```sql
-- src/db/schema.ts:39-48
CREATE TABLE snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  language TEXT NOT NULL,          -- 言語キー（例: 'go'）
  doc TEXT NOT NULL,               -- ドキュメントキー（例: 'go-spec'）
  version TEXT NOT NULL,           -- バージョン（例: 'snapshot-20260208'）
  fetched_at TEXT NOT NULL,        -- 取得日時（ISO 8601）
  etag TEXT,                       -- HTTPレスポンスのETag
  source_url TEXT NOT NULL,        -- 取得元URL
  UNIQUE(language, doc, version)   -- 同じ言語・文書・バージョンは1件のみ
);
```

「いつ」「どの言語の」「どのバージョンを」取得したかを記録します。ETagを保存することで、次回の `ingest` 時に条件付きリクエスト（`If-None-Match`）が可能になります。

### `sections` テーブル — セクションデータ

```sql
-- src/db/schema.ts:53-67
CREATE TABLE sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  language TEXT NOT NULL,          -- 言語キー
  doc TEXT NOT NULL,               -- ドキュメントキー
  version TEXT NOT NULL,           -- バージョン
  section_id TEXT NOT NULL,        -- セクション識別子（URLアンカー用）
  title TEXT NOT NULL,             -- セクションタイトル
  section_path TEXT NOT NULL,      -- 階層パス（例: 'Types > Array types'）
  canonical_url TEXT NOT NULL,     -- 公式サイトへのリンク
  excerpt TEXT NOT NULL,           -- 抜粋（最大1200文字）
  fulltext TEXT NOT NULL,          -- 全文
  content_hash TEXT NOT NULL,      -- SHA-256ハッシュ（差分検出用）
  source_policy TEXT NOT NULL DEFAULT 'excerpt_only',
  UNIQUE(language, doc, version, section_id)
);
```

仕様書の各セクション（見出しとその内容）を1行として保存します。約2,300行（4言語合計）のデータが格納されています。

### `fts_sections` — FTS5全文検索インデックス

```sql
-- src/db/schema.ts:72-78
CREATE VIRTUAL TABLE fts_sections USING fts5(
  title,                      -- セクションタイトルを検索対象に
  section_path,               -- 階層パスを検索対象に
  content,                    -- 本文を検索対象に
  content='sections',         -- データ本体は sections テーブル
  content_rowid='id',         -- sections.id と紐付け
  tokenize='porter unicode61' -- トークナイザ（後述）
);
```

## FTS5 の仕組み

FTS5 (Full-Text Search 5) は SQLite に組み込まれた全文検索エンジンです。

### 通常のSQLとFTS5の違い

```sql
-- 通常のSQL: LIKE検索（遅い、部分一致のみ）
SELECT * FROM sections WHERE fulltext LIKE '%slice%';

-- FTS5: 全文検索（高速、語幹マッチング対応）
SELECT * FROM fts_sections WHERE fts_sections MATCH 'slice';
```

### content-sync モード

`content='sections'` を指定すると、FTS5は「インデックスだけ」を管理します。実際のデータは `sections` テーブルに置かれます。

```
sections テーブル:                fts_sections (FTS5):
┌──────────────────────┐         ┌──────────────────────┐
│ id=1, title="Types", │         │ 転置インデックス:     │
│ fulltext="A type..." │────────>│  "type" → [1, 3, 5]  │
├──────────────────────┤         │  "array" → [2]       │
│ id=2, title="Array", │────────>│  "slice" → [3]       │
│ fulltext="An array.."│         │  ...                 │
└──────────────────────┘         └──────────────────────┘
  実データ                         検索用インデックスのみ
```

メリット: データの重複を避け、ストレージを節約できます。

注意: このモードでは FTS5 の `snippet()` 関数が使えません。そのため、スニペット抽出は自前で実装しています（`src/db/queries.ts` の `extractRelevantSnippet()`）。

### トークナイザ: `porter unicode61`

```
tokenize='porter unicode61'
          │        │
          │        └── Unicode正規化（大文字→小文字、アクセント除去）
          └── Porter Stemming（語幹抽出）
```

Porter Stemming は英語の語幹を抽出するアルゴリズムです:

```
"running"  → "run"    (検索ヒット: run, runs, running)
"types"    → "type"   (検索ヒット: type, types, typed)
"slicing"  → "slice"  (検索ヒット: slice, slices, slicing)
```

これにより、完全一致でなくても関連する単語がヒットします。

### BM25 スコアリング

```sql
-- src/db/queries.ts:128
bm25(fts_sections, 10.0, 5.0, 1.0) as score
--                  │     │    │
--                  │     │    └── content の重み（基準: 1.0）
--                  │     └── section_path の重み（中: 5.0）
--                  └── title の重み（高: 10.0）
```

BM25 は検索結果の関連度を計算するアルゴリズムです。タイトルに一致する結果を、本文だけに一致する結果より高く評価します。

**注意**: better-sqlite3 の BM25 は**負の値**を返します。値が小さいほど（より負であるほど）関連度が高いです。そのため `ORDER BY score`（昇順）で並べると、最も関連度の高い結果が先頭に来ます。

## トリガーによるインデックス自動同期

`sections` テーブルにデータが追加・更新・削除されたとき、FTS5インデックスが自動的に同期されます。

```sql
-- src/db/schema.ts:81-96

-- INSERT時: FTS5にも追加
CREATE TRIGGER sections_ai AFTER INSERT ON sections BEGIN
  INSERT INTO fts_sections(rowid, title, section_path, content)
  VALUES (new.id, new.title, new.section_path, new.fulltext);
END;

-- DELETE時: FTS5からも削除
CREATE TRIGGER sections_ad AFTER DELETE ON sections BEGIN
  INSERT INTO fts_sections(fts_sections, rowid, title, section_path, content)
  VALUES ('delete', old.id, old.title, old.section_path, old.fulltext);
END;

-- UPDATE時: 古いエントリを削除 → 新しいエントリを追加
CREATE TRIGGER sections_au AFTER UPDATE ON sections BEGIN
  INSERT INTO fts_sections(fts_sections, rowid, title, section_path, content)
  VALUES ('delete', old.id, old.title, old.section_path, old.fulltext);
  INSERT INTO fts_sections(rowid, title, section_path, content)
  VALUES (new.id, new.title, new.section_path, new.fulltext);
END;
```

FTS5 の削除コマンドは少し特殊で、`INSERT INTO fts_sections(fts_sections, ...)` と仮想テーブル名自体を最初のカラムに指定します。これは FTS5 の仕様です。

## マイグレーション

**対応コード**: `src/db/schema.ts:9-33`

```typescript
// src/db/schema.ts:9-33
export function initializeDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');   // WALモードを有効化
  db.pragma('foreign_keys = ON');    // 外部キー制約を有効化

  // schema_version テーブルから現在のバージョンを取得
  const currentVersion = row?.version ?? 0;

  // バージョンが古ければマイグレーションを適用
  if (currentVersion < 1) {
    applyV1(db);  // 初期スキーマを作成
  }
  // 今後 v2, v3 を追加する場合:
  // if (currentVersion < 2) applyV2(db);

  return db;
}
```

`schema_version` テーブルでバージョン番号を管理し、DBファイルが古い場合は自動的にスキーマを更新します。

### WAL モード

```
WAL (Write-Ahead Logging):

通常モード:                    WALモード:
書き込み中は読み取りブロック    書き込みと読み取りが同時に可能
  Writer ──X── Reader           Writer ──── Reader
                                   │           │
                                   v           v
                                 WALファイル  DBファイル
```

`journal_mode = WAL` を設定すると、書き込みと読み取りを同時に行えます。これにより、`ingest`（書き込み）と `serve`（読み取り）を同時に実行しても問題ありません。

## まとめ

- SQLiteはファイル1つで完結するため、個人用途に最適
- `sections` テーブルにセクション全データ、`fts_sections` にFTS5インデックス
- `content='sections'` モードで実データとインデックスを分離
- トリガーで FTS5 インデックスが自動同期される
- Porter Stemming で語幹マッチング、BM25 でスコアリング
- `schema_version` でマイグレーション管理

次のドキュメント [06-mcp-server.md](./06-mcp-server.md) では、MCPサーバの実装を詳しく解説します。
