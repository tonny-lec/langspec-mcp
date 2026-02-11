# 03: 言語設定レジストリ

## このドキュメントで学ぶこと

- 外部設定ファイル `data/sources.json` によるドキュメントソース管理
- `DocSource` 統一モデルと自動推論の仕組み
- `LanguageConfig` と `DocConfig` の内部構造
- 3つの取得戦略（FetchStrategy）の違い
- `sourcePolicy` による著作権保護の仕組み
- 新しい言語・フレームワークを追加する方法（再ビルド不要）
- `excludePaths` / `urlSuffix` による汎用ドキュメント対応

## 外部設定ファイル: `data/sources.json`

M7 で導入された外部設定ファイルにより、新しいドキュメントソースの追加に **コード修正や再ビルドが不要** になりました。

```
data/sources.json (シンプルな統一モデル)
        │
        v
  DocSource → DocConfig リゾルバ
  - url / github から fetchStrategy を自動推論
  - デフォルト値の適用
  - RegExp 文字列→オブジェクト変換
        │
        v
  DocConfig (内部型)
  - fetcher, parser, normalizer がそのまま使用
```

**対応コード**:
- `data/sources.json` — 設定ファイル
- `src/config/doc-source.ts` — DocSource 型 + Zod スキーマ + リゾルバ
- `src/config/source-loader.ts` — JSON 読み込み + バリデーション
- `src/config/languages.ts` — 遅延ロードでの LanguageConfig 提供

## DocSource — 統一モデル

`DocSource` は外部設定ファイルの1エントリを表す統一モデルです。`fetchStrategy` の指定は不要で、`url` か `github` の指定パターンから自動推論されます。

```typescript
// src/config/doc-source.ts
interface DocSource {
  // === 必須 ===
  name: string;           // DB の language キー (例: "vitest")
  displayName: string;    // 表示名 (例: "Vitest")

  // === ソース (url か github のどちらか一方) ===
  url?: string;           // HTML ソース → single-html or multi-html-toc
  github?: string;        // "owner/repo" → github-markdown

  // === オプション ===
  doc?: string;           // ドキュメント識別子 (デフォルト: name + "-docs")
  docDisplayName?: string;
  sourcePolicy?: string;  // デフォルト: github→local_fulltext_ok, url→excerpt_only
  headingSelectors?: string;  // デフォルト: "h2, h3, h4"
  notes?: string;

  // === multi-html-toc 用 ===
  chapterPattern?: string;  // 文字列 → new RegExp() で変換

  // === github-markdown 用 ===
  path?: string;            // リポジトリ内パス (デフォルト: "")
  manifestFile?: string;    // 例: "SUMMARY.md"
  excludePaths?: string[];  // 除外ディレクトリ

  // === URL 構築 ===
  canonicalBaseUrl?: string;
  urlSuffix?: string;       // デフォルト: ".html"。VitePress は ""
}
```

### 戦略の自動推論ルール

| 条件 | 推論される fetchStrategy |
|------|------------------------|
| `github` あり | `github-markdown` |
| `url` + `chapterPattern` あり | `multi-html-toc` |
| `url` のみ | `single-html` |

### デフォルト値

| フィールド | デフォルト値 |
|-----------|------------|
| `doc` | `${name}-docs` |
| `sourcePolicy` | github → `local_fulltext_ok`, url → `excerpt_only` |
| `headingSelectors` | `"h2, h3, h4"` |
| `path` (github) | `""` |
| `canonicalBaseUrl` (single-html) | `url` そのまま |
| `canonicalBaseUrl` (multi-html-toc) | `url` のディレクトリ部分 |

## data/sources.json の例

```json
[
  {
    "name": "go",
    "displayName": "Go",
    "doc": "go-spec",
    "docDisplayName": "The Go Programming Language Specification",
    "url": "https://go.dev/ref/spec",
    "sourcePolicy": "excerpt_only"
  },
  {
    "name": "java",
    "displayName": "Java",
    "doc": "jls",
    "docDisplayName": "The Java Language Specification (SE21)",
    "url": "https://docs.oracle.com/javase/specs/jls/se21/html/index.html",
    "chapterPattern": "^jls-\\d+\\.html$",
    "sourcePolicy": "excerpt_only"
  },
  {
    "name": "vitest",
    "displayName": "Vitest",
    "doc": "vitest-docs",
    "docDisplayName": "Vitest Documentation",
    "github": "vitest-dev/vitest",
    "path": "docs",
    "excludePaths": [".vitepress", "team", "public"],
    "canonicalBaseUrl": "https://vitest.dev",
    "urlSuffix": ""
  }
]
```

## 設定レジストリの内部構造

`sources.json` から読み込まれた設定は、内部で `LanguageConfig` / `DocConfig` に変換されます。

### LanguageConfig — 言語の定義

```typescript
// src/config/languages.ts
interface LanguageConfig {
  language: string;       // 内部キー（例: 'go', 'java'）
  displayName: string;    // 表示名（例: 'Go', 'Java'）
  docs: DocConfig[];      // この言語に属するドキュメント群
}
```

1つの言語に複数のドキュメントを持たせることができます（例: 言語仕様 + 標準ライブラリ）。現在は各言語に1つずつです。

### DocConfig — ドキュメントの定義

```typescript
// src/config/languages.ts
interface DocConfig {
  doc: string;                // ドキュメント識別子（例: 'go-spec'）
  displayName: string;        // 表示名
  fetchStrategy: FetchStrategy; // 取得方法（後述）
  sourcePolicy: 'excerpt_only' | 'local_fulltext_ok';
  headingSelectors?: string;  // HTMLで使う見出しセレクタ
  notes?: string;             // 補足メモ

  // single-html / multi-html-toc 用
  url?: string;               // ページURL
  indexUrl?: string;          // 目次ページURL
  chapterPattern?: RegExp;    // 章リンクの正規表現パターン

  // github-markdown 用
  githubOwner?: string;       // GitHubオーナー
  githubRepo?: string;        // リポジトリ名
  githubPath?: string;        // ファイルパス
  manifestFile?: string;      // マニフェストファイル（例: SUMMARY.md）
  canonicalBaseUrl?: string;  // 正規化URLのベース
  excludePaths?: string[];    // 再帰探索で除外するパス
  urlSuffix?: string;         // URL末尾（デフォルト '.html'、VitePress は ''）
}
```

### 遅延ロード

`src/config/languages.ts` は `data/sources.json` を **遅延ロード** します。最初にアクセスされた時点で1回だけ読み込み・パース・バリデーションが行われます:

```typescript
// src/config/languages.ts (概要)
let _languages: LanguageConfig[] | null = null;

function ensureLoaded(): void {
  if (!_languages) {
    _languages = loadSources();  // sources.json → LanguageConfig[]
  }
}
```

## 3つの取得戦略（FetchStrategy）

```typescript
type FetchStrategy = 'single-html' | 'multi-html-toc' | 'github-markdown';
```

### 1. `single-html` — 1ページHTML

```
  1回のHTTPリクエスト
         │
         v
  ┌──────────────┐
  │ https://go.  │     ← 全仕様が1ページに収まっている
  │ dev/ref/spec │
  │              │
  │ h2: Types    │
  │ h3: Array    │
  │ h3: Slice    │
  │ h2: ...      │
  └──────────────┘
```

**使用言語**: Go

最もシンプルな戦略です。1つのURLにアクセスするだけで仕様書全体が手に入ります。`url` フィールドのみ指定で自動推論されます。

### 2. `multi-html-toc` — 目次 + 複数章

```
  目次ページ取得          各章を順次取得
       │                   │
       v                   v
  ┌──────────┐    ┌───┐ ┌───┐ ┌───┐
  │ index.html│──> │ch1│ │ch2│ │ch3│ ...
  │           │    │   │ │   │ │   │
  │ - ch1     │    └───┘ └───┘ └───┘
  │ - ch2     │      19章分を順番に取得
  │ - ch3     │      (200ms間隔で礼儀正しく)
  │ - ...     │
  └──────────┘
```

**使用言語**: Java (JLS)

`url` + `chapterPattern` の組み合わせで自動推論されます。

### 3. `github-markdown` — GitHubリポジトリのMarkdown

```
  SUMMARY.md取得         各.mdファイルを順次取得
       │                      │
       v                      v
  ┌──────────┐    ┌─────┐ ┌─────┐ ┌─────┐
  │SUMMARY.md│──> │ch1.md│ │ch2.md│ │ch3.md│ ...
  │          │    │      │ │      │ │      │
  │ - [ch1]  │    └──────┘ └──────┘ └──────┘
  │ - [ch2]  │     raw.githubusercontent.com
  │ - [ch3]  │     から取得
  └──────────┘
```

**使用言語**: Rust, TypeScript, Vitest

`github` フィールドの指定で自動推論されます。ファイル一覧の取得方法は2通り:

1. **マニフェストファイル方式** (`manifestFile` 指定時): `SUMMARY.md` などのマニフェストからファイル一覧を取得（Rust）
2. **再帰的ディレクトリ探索** (`manifestFile` 未指定時): GitHub Contents API でディレクトリを再帰的に探索し、`.md` ファイルを収集。`excludePaths` で不要なディレクトリを除外可能（TypeScript, Vitest）

## sourcePolicy — 著作権保護

| ポリシー | 意味 | 対象 |
|---------|------|------|
| `excerpt_only` | 抜粋（最初の1200文字）のみ提供 | Go, Java（著作権保護） |
| `local_fulltext_ok` | 全文を提供可能 | Rust, TypeScript, Vitest（オープンソース） |

Go や Java の仕様書は著作権で保護されているため、AIに全文を渡すことは避け、抜粋と公式サイトへのリンクを提供します。Rust や TypeScript のドキュメントはオープンソースライセンスなので全文提供が可能です。

## 新しい言語・フレームワークを追加する方法

新しいドキュメントを追加するには、`data/sources.json` に1つエントリを追加するだけです。**コード修正も再ビルドも不要**です。

### 例1: Python（1ページHTMLドキュメント）

```json
{
  "name": "python",
  "displayName": "Python",
  "doc": "python-reference",
  "docDisplayName": "The Python Language Reference",
  "url": "https://docs.python.org/3/reference/index.html",
  "headingSelectors": "h1, h2, h3",
  "sourcePolicy": "excerpt_only"
}
```

### 例2: Vite（GitHub + VitePress clean URLs）

```json
{
  "name": "vite",
  "displayName": "Vite",
  "doc": "vite-docs",
  "docDisplayName": "Vite Documentation",
  "github": "vitejs/vite",
  "path": "docs",
  "excludePaths": [".vitepress", "blog"],
  "canonicalBaseUrl": "https://vite.dev",
  "urlSuffix": ""
}
```

### 追加後の手順

```bash
# 再ビルド不要！ そのままインジェスト実行
npm run ingest -- --language vite     # 新ドキュメントを取り込み
```

これだけで、MCPサーバの `list_languages` ツールに新しいエントリが表示され、`search_spec` で検索できるようになります。

## ユーティリティ関数

`src/config/languages.ts` は設定データを参照するための関数を提供します:

```typescript
getLanguageConfig('go')       // → LanguageConfig（言語全体の設定）
getDocConfig('go')            // → DocConfig（最初のドキュメント設定）
getDocConfig('go', 'go-spec') // → DocConfig（特定ドキュメント）
getSupportedLanguages()       // → ['go', 'java', 'rust', 'typescript', 'vitest']
getAllLanguageConfigs()        // → LanguageConfig[] (全設定)
```

`getSupportedLanguages()` は MCP ツールの `enum` として使われ、AIが「どの言語を指定できるか」を知るための情報源になります（`src/server.ts`）。

## まとめ

- ドキュメントソースは `data/sources.json` で外部管理（コード変更・再ビルド不要）
- `DocSource` 統一モデルで `url` / `github` を指定するだけで `fetchStrategy` を自動推論
- 3つの取得戦略で異なる形式の仕様書・ドキュメントに対応
- `sourcePolicy` で著作権保護レベルを制御
- `excludePaths` で不要なディレクトリを除外、`urlSuffix` で URL 形式を制御
- 新しい言語やフレームワークの追加は JSON に1エントリ追加 → `npm run ingest` するだけ

次のドキュメント [04-ingestion-pipeline.md](./04-ingestion-pipeline.md) では、データ取り込みパイプラインの詳細を解説します。
