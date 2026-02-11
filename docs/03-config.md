# 03: 言語設定レジストリ

## このドキュメントで学ぶこと

- `LanguageConfig` と `DocConfig` の構造
- 3つの取得戦略（FetchStrategy）の違い
- `sourcePolicy` による著作権保護の仕組み
- 新しい言語・フレームワークを追加する方法
- `excludePaths` / `urlSuffix` による汎用ドキュメント対応

## 設定レジストリとは

このプロジェクトは複数のプログラミング言語の仕様書を扱います。しかし、言語ごとに仕様書の公開形式が異なります:

- Go: 1ページのHTMLに全仕様が載っている
- Java: 目次ページ + 複数の章ページに分かれている
- Rust: GitHubリポジトリにMarkdownファイルが並んでいる
- Vitest: GitHubリポジトリにネストされたサブディレクトリ構造のMarkdown

これらの違いを吸収するために、各言語の設定を1つの配列 `LANGUAGES` に集約しています。

**対応コード**: `src/config/languages.ts`

## データ構造

### LanguageConfig — 言語の定義

```typescript
// src/config/languages.ts:24-28
interface LanguageConfig {
  language: string;       // 内部キー（例: 'go', 'java'）
  displayName: string;    // 表示名（例: 'Go', 'Java'）
  docs: DocConfig[];      // この言語に属するドキュメント群
}
```

1つの言語に複数のドキュメントを持たせることができます（例: 言語仕様 + 標準ライブラリ）。現在は各言語に1つずつです。

### DocConfig — ドキュメントの定義

```typescript
// src/config/languages.ts:3-24
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
  excludePaths?: string[];    // 再帰探索で除外するパス（例: ['.vitepress', 'team']）
  urlSuffix?: string;         // URL末尾（デフォルト '.html'、VitePress は ''）
}
```

## 3つの取得戦略（FetchStrategy）

```typescript
// src/config/languages.ts:1
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

最もシンプルな戦略です。1つのURLにアクセスするだけで仕様書全体が手に入ります。

```typescript
// src/config/languages.ts:32-44 (Go の設定)
{
  language: 'go',
  displayName: 'Go',
  docs: [{
    doc: 'go-spec',
    displayName: 'The Go Programming Language Specification',
    fetchStrategy: 'single-html',
    url: 'https://go.dev/ref/spec',
    headingSelectors: 'h2, h3, h4',
    sourcePolicy: 'excerpt_only',
    canonicalBaseUrl: 'https://go.dev/ref/spec',
  }],
}
```

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

まず目次ページ（`index.html`）を取得し、そこからリンクを抽出して各章を順次ダウンロードします。サーバに負荷をかけないよう、リクエスト間に遅延（200ms）を入れています。

```typescript
// src/config/languages.ts:48-59 (Java の設定)
{
  language: 'java',
  displayName: 'Java',
  docs: [{
    doc: 'jls',
    displayName: 'The Java Language Specification (SE21)',
    fetchStrategy: 'multi-html-toc',
    indexUrl: 'https://docs.oracle.com/javase/specs/jls/se21/html/index.html',
    headingSelectors: 'h2, h3, h4',
    sourcePolicy: 'excerpt_only',
    canonicalBaseUrl: 'https://docs.oracle.com/javase/specs/jls/se21/html',
  }],
}
```

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

GitHubリポジトリ内のMarkdownファイル群を取得します。ファイル一覧の取得方法は2通り:

1. **マニフェストファイル方式** (`manifestFile` 指定時): `SUMMARY.md` などのマニフェストからファイル一覧を取得（Rust）
2. **再帰的ディレクトリ探索** (`manifestFile` 未指定時): GitHub Contents API でディレクトリを再帰的に探索し、`.md` ファイルを収集。`excludePaths` で不要なディレクトリを除外可能（TypeScript, Vitest）

```typescript
// Rust の設定（マニフェスト方式）
{
  language: 'rust',
  displayName: 'Rust',
  docs: [{
    doc: 'rust-reference',
    displayName: 'The Rust Reference',
    fetchStrategy: 'github-markdown',
    githubOwner: 'rust-lang',
    githubRepo: 'reference',
    githubPath: 'src',
    manifestFile: 'SUMMARY.md',
    sourcePolicy: 'local_fulltext_ok',
    canonicalBaseUrl: 'https://doc.rust-lang.org/reference',
  }],
}
```

```typescript
// Vitest の設定（再帰的ディレクトリ探索 + VitePress clean URLs）
{
  language: 'vitest',
  displayName: 'Vitest',
  docs: [{
    doc: 'vitest-docs',
    displayName: 'Vitest Documentation',
    fetchStrategy: 'github-markdown',
    githubOwner: 'vitest-dev',
    githubRepo: 'vitest',
    githubPath: 'docs',
    sourcePolicy: 'local_fulltext_ok',
    canonicalBaseUrl: 'https://vitest.dev',
    excludePaths: ['.vitepress', 'team', 'public'],  // ビルド設定・チームページ・静的アセットを除外
    urlSuffix: '',                           // VitePress clean URLs (.html不要)
  }],
}
```

## sourcePolicy — 著作権保護

```typescript
sourcePolicy: 'excerpt_only' | 'local_fulltext_ok'
```

| ポリシー | 意味 | 対象 |
|---------|------|------|
| `excerpt_only` | 抜粋（最初の1200文字）のみ提供 | Go, Java（著作権保護） |
| `local_fulltext_ok` | 全文を提供可能 | Rust, TypeScript, Vitest（オープンソース） |

Go や Java の仕様書は著作権で保護されているため、AIに全文を渡すことは避け、抜粋と公式サイトへのリンクを提供します。Rust や TypeScript のドキュメントはオープンソースライセンスなので全文提供が可能です。

この値は `get_section` ツールで使われます（`src/tools/get-section.ts:28`）:

```typescript
const fulltextAvailable = section.source_policy === 'local_fulltext_ok';
// fulltext_available が false なら excerpt のみ返す
```

## 新しい言語・フレームワークを追加する方法

新しいドキュメントを追加するには、`src/config/languages.ts` の `LANGUAGES` 配列に1つエントリを追加するだけです。`language` フィールドはプログラミング言語だけでなく、フレームワークやツール（Vitest, Vite, React 等）にも使えます。

### 例1: Python（single-html）

```typescript
{
  language: 'python',
  displayName: 'Python',
  docs: [{
    doc: 'python-reference',
    displayName: 'The Python Language Reference',
    fetchStrategy: 'single-html',
    url: 'https://docs.python.org/3/reference/index.html',
    headingSelectors: 'h1, h2, h3',
    sourcePolicy: 'excerpt_only',
    canonicalBaseUrl: 'https://docs.python.org/3/reference',
  }],
}
```

### 例2: Vite（github-markdown + VitePress clean URLs）

```typescript
{
  language: 'vite',
  displayName: 'Vite',
  docs: [{
    doc: 'vite-docs',
    displayName: 'Vite Documentation',
    fetchStrategy: 'github-markdown',
    githubOwner: 'vitejs',
    githubRepo: 'vite',
    githubPath: 'docs',
    sourcePolicy: 'local_fulltext_ok',
    canonicalBaseUrl: 'https://vite.dev',
    excludePaths: ['.vitepress', 'blog'],
    urlSuffix: '',   // VitePress clean URLs
  }],
}
```

### 追加後の手順

```bash
npm run build                         # TypeScriptを再コンパイル
npm run ingest -- --language vite     # 新ドキュメントを取り込み
```

これだけで、MCPサーバの `list_languages` ツールに新しいエントリが表示され、`search_spec` で検索できるようになります。コードの他の部分を変更する必要はありません。

## ユーティリティ関数

`src/config/languages.ts` は設定データだけでなく、それを参照するための関数も提供します:

```typescript
// src/config/languages.ts:102-128
getLanguageConfig('go')       // → LanguageConfig（言語全体の設定）
getDocConfig('go')            // → DocConfig（最初のドキュメント設定）
getDocConfig('go', 'go-spec') // → DocConfig（特定ドキュメント）
getSupportedLanguages()       // → ['go', 'java', 'rust', 'typescript', 'vitest']
getAllLanguageConfigs()        // → LanguageConfig[] (全設定)
```

`getSupportedLanguages()` は MCP ツールの `enum` として使われ、AIが「どの言語を指定できるか」を知るための情報源になります（`src/server.ts:31`）。

## まとめ

- 言語設定は `LANGUAGES` 配列に集約されている
- 3つの取得戦略で異なる形式の仕様書・ドキュメントに対応
- `sourcePolicy` で著作権保護レベルを制御
- `excludePaths` で不要なディレクトリを除外、`urlSuffix` で URL 形式を制御
- 新しい言語やフレームワークの追加は配列に1エントリ追加するだけ

次のドキュメント [04-ingestion-pipeline.md](./04-ingestion-pipeline.md) では、データ取り込みパイプラインの詳細を解説します。
