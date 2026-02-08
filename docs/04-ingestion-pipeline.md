# 04: データ取り込みパイプライン

## このドキュメントで学ぶこと

- 仕様書を取り込む5ステップの全体像
- ダウンロード処理（3つの戦略の具体的な動作）
- HTML/Markdown の解析とセクション分割のロジック
- 正規化（URL構築、ハッシュ生成）
- DB保存と差分検出の仕組み

## パイプライン全体図

`npm run ingest -- --language go` を実行すると、以下の5ステップが順番に実行されます:

```
Step 1: ダウンロード (fetcher.ts)
  │  インターネットから仕様書をHTTPで取得
  │  戦略に応じて1ページ or 複数ページ
  v
Step 2: 解析 (parser.ts)
  │  HTML/Markdownを読み込み、
  │  見出しごとにセクションに分割
  v
Step 3: 正規化 (normalizer.ts)
  │  正規URL構築、抜粋作成、
  │  コンテンツハッシュ計算
  v
Step 4: DB保存 (ingestion/index.ts)
  │  トランザクション内でupsert、
  │  差分検出（inserted/updated/unchanged）
  v
Step 5: レポート
     何件挿入/更新/変更なしかをログ出力
```

オーケストレーター（指揮者）の役割を果たすのが `src/ingestion/index.ts` の `ingestSpec()` 関数です。

## Step 1: ダウンロード — `fetcher.ts`

**対応コード**: `src/ingestion/fetcher.ts`

### エントリーポイント: `fetchSpec()`

```typescript
// src/ingestion/fetcher.ts:271-288
export async function fetchSpec(config: DocConfig, opts: FetchSpecOptions = {}): Promise<FetchOutcome> {
  switch (config.fetchStrategy) {
    case 'single-html':
      return fetchSingleHtml(config, opts.snapshotEtag, ctx);
    case 'multi-html-toc':
      return fetchMultiHtmlToc(config, ctx);
    case 'github-markdown':
      return fetchGithubMarkdown(config, ctx);
  }
}
```

設定の `fetchStrategy` に応じて、3つの取得関数を使い分けます。

### `fetchSingleHtml()` — 1回のHTTPリクエスト

```
  fetchUrl('https://go.dev/ref/spec')
       │
       v
  200 OK → HTML本文 + ETag を返す
  304 Not Modified → キャッシュから返す（変更なし）
```

最もシンプルです。1つのURLに対して `fetch()` を呼ぶだけです。ETag（ファイルの「指紋」のようなもの）を使って、前回から変更がなければダウンロードをスキップします。

### `fetchMultiHtmlToc()` — 目次から章を抽出

```typescript
// src/ingestion/fetcher.ts:133-183 の流れ
// 1. 目次ページを取得
const { body: indexHtml } = await fetchUrl(indexUrl);

// 2. cheerioでHTMLを解析し、章のリンクを抽出
const $ = load(indexHtml!);
$('a[href]').each((_, elem) => {
  const href = $(elem).attr('href');
  if (href && /^jls-\d+\.html$/.test(href)) {
    chapterLinks.push(href);
  }
});

// 3. 各章を順次取得（200ms間隔）
for (const link of chapterLinks) {
  const result = await fetchWithCache(chapterUrl, ctx);
  results.push(result);
  await delay(delayMs);  // サーバに優しく
}
```

Java JLS の場合、`index.html` から `jls-1.html`, `jls-2.html`, ... のリンクを正規表現で抽出し、順番にダウンロードします。

### `fetchGithubMarkdown()` — GitHubからMarkdownファイル群を取得

```typescript
// src/ingestion/fetcher.ts:203-263 の流れ
// 1. SUMMARY.md（マニフェスト）を取得してファイル一覧を解析
//    または GitHub API でディレクトリ一覧を取得
const { body: manifest } = await fetchUrl(manifestUrl);
mdFiles = parseSummaryMd(manifest!, basePath);

// 2. 各Markdownファイルを順次取得（100ms間隔）
for (const filePath of mdFiles) {
  const fileUrl = `${rawBase}/${filePath}`;
  const result = await fetchWithCache(fileUrl, ctx);
  results.push(result);
  await delay(delayMs);
}
```

`raw.githubusercontent.com` からMarkdownファイルの生テキストを取得します。

### `FetchOutcome` パターン — 部分失敗への対応

すべての取得関数は `FetchOutcome` 型を返します:

```typescript
// src/types.ts:59-68
interface FetchOutcome {
  results: FetchResult[];   // 成功したページ群
  errors: FetchError[];     // 失敗したページ群
  summary: {
    total: number;          // 全ページ数
    fetched: number;        // 新規取得した数
    cached: number;         // キャッシュから取得した数
    failed: number;         // 失敗した数
  };
}
```

複数ページを取得する際、一部のページが失敗しても残りは処理を続けます。全ページが失敗した場合のみエラーをスローします。

```
20ページ中 18ページ成功、2ページ失敗
→ 18ページ分は正常に処理。失敗分はログに警告を出力。
→ サーバの一時的な問題なら、次回 ingest で自動復旧。
```

## Step 2: 解析 — `parser.ts`

**対応コード**: `src/ingestion/parser.ts`

ダウンロードしたHTML/Markdownを読み込み、見出しごとに「セクション」に分割します。

### HTMLパーサ: `parseHtmlSpec()`

cheerio（jQueryライクなHTMLパーサ）を使ってDOMとして読み込みます。

```typescript
// src/ingestion/parser.ts:18-79 の概要
export function parseHtmlSpec(html: string, config: DocConfig, pageUrl?: string): ParsedSection[] {
  const $ = load(html);
  const headings = $(fullSelector);  // h2, h3, h4 を抽出

  headings.each((i, elem) => {
    const title = $heading.text().trim();

    // 見出しの後から次の見出しまでの内容を本文として取得
    let $next = $heading.next();
    while ($next.length > 0) {
      // 次の見出しに到達したら終了
      if (nextTag && selectors.some(s => ...)) break;
      contentParts.push($next.text().trim());
      $next = $next.next();
    }

    sections.push({
      section_id: sectionId,
      title,
      section_path: sectionPath,  // 階層パス
      content: contentParts.join('\n\n'),
    });
  });
}
```

動作イメージ:

```html
<h2 id="Types">Types</h2>
<p>A type determines a set of values...</p>

<h3 id="Array_types">Array types</h3>
<p>An array is a numbered sequence...</p>

<h3 id="Slice_types">Slice types</h3>
<p>A slice is a descriptor...</p>
```

↓ 解析結果:

```
セクション1: { id: "Types",       path: "Types",                  content: "A type determines..." }
セクション2: { id: "Array_types", path: "Types > Array types",    content: "An array is..." }
セクション3: { id: "Slice_types", path: "Types > Slice types",    content: "A slice is..." }
```

### 階層パス（section_path）の構築

見出しレベル（h2, h3, h4）を使って、パンくず式の階層パスを構築します:

```
pathStack の変化:

h2 "Types"       → pathStack: [{level:2, title:"Types"}]
                   → path: "Types"

h3 "Array types" → pathStack: [{level:2, title:"Types"}, {level:3, title:"Array types"}]
                   → path: "Types > Array types"

h3 "Slice types" → pop(level>=3), push
                   pathStack: [{level:2, title:"Types"}, {level:3, title:"Slice types"}]
                   → path: "Types > Slice types"

h2 "Statements"  → pop(level>=2), push
                   pathStack: [{level:2, title:"Statements"}]
                   → path: "Statements"
```

### Section ID の安定化

セクションIDはURLのアンカー（`#Types`）として使われるため、安定している必要があります。

```typescript
// src/ingestion/parser.ts:44
const sectionId = $heading.attr('id') || stableId(baseUrl, title, i);
```

1. HTMLの見出しに `id` 属性がある → そのまま使用（例: `id="Types"`）
2. `id` 属性がない → `stableId()` でSHA-256ハッシュから生成（例: `gen-a3b2c1d4e5f6`）

```typescript
// src/ingestion/parser.ts:9-12
function stableId(baseUrl: string, headingText: string, index: number): string {
  const input = `${baseUrl}|${headingText}|${index}`;
  return 'gen-' + createHash('sha256').update(input).digest('hex').substring(0, 12);
}
```

### Markdownパーサ: `parseMarkdownSpec()`

Markdownの場合は `#` で始まる行を見出しとして検出します。

```typescript
// src/ingestion/parser.ts:128-225 の概要
// 1. フロントマター（---で囲まれたメタデータ）を解析
const { frontMatter, body } = parseFrontMatter(markdown);

// 2. Twoslash記法（TypeScript Handbook特有）を除去
const cleaned = stripTwoslash(body);

// 3. 各行を走査
for (const line of lines) {
  const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
  if (headingMatch) {
    // 前のセクションを確定
    flushSection();
    // 新しいセクションを開始
    currentTitle = headingMatch[2].trim();
    currentLevel = headingMatch[1].length;  // # の数 = レベル
  } else {
    currentContent.push(line);
  }
}
```

フェンスドコードブロック（`` ``` `` で囲まれた部分）の中にある `#` は見出しとして扱わないよう、追跡しています:

```typescript
// src/ingestion/parser.ts:164-167
if (/^(`{3,}|~{3,})/.test(line)) {
  inFencedBlock = !inFencedBlock;  // コードブロックの開始/終了を切り替え
}
```

## Step 3: 正規化 — `normalizer.ts`

**対応コード**: `src/ingestion/normalizer.ts`

解析されたセクションに、DB保存に必要な情報を付加します。

```typescript
// src/ingestion/normalizer.ts:4-39
export function normalizeSections(sections: ParsedSection[], meta: { ... }): NormalizedSection[] {
  return sections.map(s => {
    const fulltext = s.content;

    // 1. 抜粋: 最初の1200文字を切り出し
    const excerpt = fulltext.length > EXCERPT_MAX_LENGTH
      ? fulltext.substring(0, EXCERPT_MAX_LENGTH) + '...'
      : fulltext;

    // 2. 正規URL: 戦略に応じた組み立て
    const canonicalUrl = buildCanonicalUrl(meta.baseUrl, s.section_id, s.pageUrl, meta.pageUrlPrefix);

    // 3. コンテンツハッシュ: SHA-256で変更検出用
    const content_hash = hashContent(fulltext);

    return { ...fields, excerpt, canonicalUrl, content_hash, source_policy };
  });
}
```

### 正規URL の構築

戦略によってURLの組み立て方が異なります:

```typescript
// src/ingestion/normalizer.ts:41-64
function buildCanonicalUrl(baseUrl, sectionId, pageUrl, pageUrlPrefix): string {
  if (!pageUrl) {
    // single-html: https://go.dev/ref/spec#Types
    return `${baseUrl}#${sectionId}`;
  }
  if (pageUrl.startsWith('http')) {
    // multi-html-toc: https://docs.oracle.com/.../jls-4.html#Types
    return `${pageUrl}#${sectionId}`;
  }
  // github-markdown: https://doc.rust-lang.org/reference/types.html#array-types
  return `${baseUrl}/${pageName}.html#${sectionId}`;
}
```

### コンテンツハッシュ

```typescript
// src/db/schema.ts:104-106
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
```

内容のSHA-256ハッシュを計算します。次回の `ingest` 時にこのハッシュを比較し、内容が変わっていなければ更新をスキップできます。

## Step 4: DB保存 — `ingestion/index.ts`

**対応コード**: `src/ingestion/index.ts`

### オーケストレーター: `ingestSpec()`

```typescript
// src/ingestion/index.ts:14-100 の流れ
export async function ingestSpec(db: Database.Database, language: string, cacheDir?: string): Promise<void> {
  const docConfig = getDocConfig(language);
  const queries = new DatabaseQueries(db);
  const version = `snapshot-${yyyymmdd}`;  // 例: snapshot-20260208

  // 1. 前回のETagを取得（条件付きリクエスト用）
  const previousSnapshot = queries.getLatestSnapshot(language, docConfig.doc);

  // 2. ダウンロード
  const outcome = await fetchSpec(docConfig, { snapshotEtag, cache, language });

  // 3. 全ページ304なら処理終了（変更なし）
  if (allUnchanged) return;

  // 4. 解析 + 正規化
  for (const result of outcome.results) {
    if (result.status === 304) continue;  // 変更なしページはスキップ
    const parsed = parseSpec(result.html, docConfig, result.pageUrl);
    const normalized = normalizeSections(parsed, { ... });
    allNormalized.push(...normalized);
  }

  // 5. トランザクション内でDB保存
  const transaction = db.transaction(() => {
    queries.upsertSnapshot({ ... });
    for (const section of allNormalized) {
      const result = queries.upsertSection(section);
      counters[result]++;  // inserted / updated / unchanged
    }
  });
  transaction();
}
```

### 差分検出の仕組み

`upsertSection()` はハッシュを比較して、3つの結果を返します:

```typescript
// src/db/queries.ts:53-84
upsertSection(s): UpsertResult {
  const existingHash = this.getSectionHash(s.language, s.doc, s.version, s.section_id);

  if (existingHash === s.content_hash) {
    return 'unchanged';  // ハッシュ同一 → スキップ
  }

  // INSERT ... ON CONFLICT DO UPDATE
  this.db.prepare(`...`).run(...);

  return existingHash === undefined ? 'inserted' : 'updated';
}
```

```
初回 ingest:   全セクションが 'inserted'  → "162 inserted, 0 updated, 0 unchanged"
2回目 ingest:  変更なし → "0 inserted, 0 updated, 162 unchanged"
仕様更新後:    一部変更 → "0 inserted, 3 updated, 159 unchanged"
```

## まとめ

- パイプラインは「取得 → 解析 → 正規化 → 保存」の4ステップ
- 取得戦略は3種類あり、言語設定で切り替える
- HTMLは cheerio でDOM解析、Markdownは行ベースで見出し検出
- 正規化でURL構築とハッシュ計算を行う
- 差分検出により、変更のないセクションの無駄な更新を避ける

次のドキュメント [05-database.md](./05-database.md) では、SQLiteデータベースの設計を詳しく解説します。
