# 06: MCPサーバの仕組み

## このドキュメントで学ぶこと

- MCPプロトコルの通信の仕組み（JSON-RPC 2.0, stdio）
- ツール登録の方法（ListToolsRequestSchema）
- ツール実行の流れ（CallToolRequestSchema）
- 5つのツールの詳細な動作
- 検索のスコアリングとスニペット抽出

## MCPプロトコルの基本

### JSON-RPC 2.0

MCPは**JSON-RPC 2.0**というプロトコルの上に構築されています。これは「JSONでリクエストとレスポンスをやり取りする」シンプルな仕組みです。

```
リクエスト（AIからサーバへ）:
{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}

レスポンス（サーバからAIへ）:
{"jsonrpc": "2.0", "id": 1, "result": {"tools": [...]}}
```

- `method`: どんな操作をしたいか（`tools/list` = ツール一覧、`tools/call` = ツール実行）
- `id`: リクエストとレスポンスを紐付けるための番号
- `params`: リクエストのパラメータ
- `result`: レスポンスの結果

### stdio トランスポート

```
┌───────────────────┐     stdin      ┌───────────────────┐
│                   │ ──────────────>│                   │
│  Claude Desktop   │                │  langspec-mcp     │
│  (MCPクライアント)  │     stdout     │  (MCPサーバ)       │
│                   │ <──────────────│                   │
└───────────────────┘                └───────────────────┘
```

MCPの通信は**標準入力（stdin）**と**標準出力（stdout）**を使って行われます。

- Claude Desktop がサーバプロセスを起動する
- stdin にJSONリクエストを書き込む
- stdout からJSONレスポンスを読み取る

**だから `console.log()` は絶対に使えません！** `console.log()` は stdout に出力するため、JSON-RPCの通信を壊してしまいます。デバッグ出力はすべて stderr（`process.stderr.write()`）に書き出します。

### MCP SDKの抽象化

```typescript
// src/server.ts:1-6
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
```

MCP SDKが提供する `Server` クラスと `StdioServerTransport` を使えば、JSON-RPCの解析やstdio通信の詳細を気にせず実装できます。

```typescript
// src/server.ts:25-29, 218-220
const server = new Server(
  { name: 'langspec-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

## ツール登録 — ListToolsRequestSchema

AIが「どんなツールが使えるか？」と聞いたとき、サーバはツール一覧を返します。

```typescript
// src/server.ts:34-165
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_spec',
      description: 'Search language specification sections using full-text search.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          language: {
            type: 'string',
            enum: ['go', 'java', 'rust', 'typescript'],  // 選択肢を教える
          },
          // ...
        },
        required: ['query', 'language'],
      },
      annotations: {
        readOnlyHint: true,       // データを読むだけ（書き込まない）
        destructiveHint: false,   // 破壊的操作ではない
        idempotentHint: true,     // 何度呼んでも同じ結果
      },
    },
    // ... 他のツール
  ],
}));
```

ポイント:

- **`inputSchema`**: JSON Schema形式で引数の型を定義。AIはこれを見て正しい引数を組み立てる
- **`enum`**: 選択可能な値を列挙。AIが存在しない言語を指定するのを防ぐ
- **`annotations`**: ツールの性質をAIに伝える。読み取り専用なので安全に呼べる

`enum` の値は `getSupportedLanguages()` から動的に生成されます（`src/server.ts:31`）。言語を追加すると自動的にツールの選択肢にも反映されます。

## ツール実行 — CallToolRequestSchema

AIがツールを呼ぶと、`{name, arguments}` がリクエストとして届きます。

```typescript
// src/server.ts:168-216
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_spec': {
        const params = SearchSpecInputSchema.parse(args);  // Zodでバリデーション
        const result = searchSpec(db, params);              // ハンドラ関数を呼び出し
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)           // JSON文字列で返す
          }]
        };
      }
      // ... 他のツール
    }
  } catch (error) {
    // エラー時は isError: true をセット
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});
```

処理の流れ:

```
1. AIが tools/call リクエストを送信
   {"method": "tools/call", "params": {"name": "search_spec", "arguments": {"query": "slice", "language": "go"}}}
       │
       v
2. switch文でツール名を判定
       │
       v
3. Zodスキーマでバリデーション
   SearchSpecInputSchema.parse(args)
   → 不正な引数ならZodErrorをスロー
       │
       v
4. ハンドラ関数を呼び出し
   searchSpec(db, params)
       │
       v
5. 結果をJSON文字列にしてレスポンス
   { content: [{ type: "text", text: "..." }] }
```

### Zodバリデーション

**対応コード**: `src/types.ts:120-152`

Zodは実行時の型チェックライブラリです。AIから送られてきたパラメータが正しい型かどうかを検証します。

```typescript
// src/types.ts:130-139
export const SearchSpecInputSchema = z.object({
  query: z.string().min(1),          // 空文字は拒否
  language: LanguageEnum,             // 登録済み言語のみ許可
  version: z.string().optional(),     // 省略可能
  filters: z.object({
    doc: z.string().optional(),
    section_path_prefix: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }).optional(),
});
```

## 5つのツール詳細

### `list_languages` — 対応言語一覧

**対応コード**: `src/tools/list-languages.ts`

データベースに取り込み済みの言語一覧を返します。

```
入力: なし
出力: [
  { language: "go", docs: ["go-spec"] },
  { language: "java", docs: ["jls"] },
  ...
]
```

### `list_versions` — バージョン一覧

**対応コード**: `src/tools/list-versions.ts`

指定した言語の取得済みバージョン一覧を返します。

```
入力: { language: "go" }
出力: [
  { version: "snapshot-20260208", fetched_at: "2026-02-08T...", source_url: "..." }
]
```

### `search_spec` — 全文検索

**対応コード**: `src/tools/search-spec.ts`, `src/db/queries.ts:97-158`

FTS5 を使って仕様書を全文検索し、関連度順に結果を返します。

```
入力: { query: "slice types", language: "go" }
出力: [
  {
    title: "Slice types",
    section_path: "Types > Slice types",
    url: "https://go.dev/ref/spec#Slice_types",
    snippet: { text: "A slice is a descriptor for a contiguous segment...", ... },
    score: -15.234  (負の値。小さいほど関連度が高い)
  },
  ...
]
```

検索の流れ:

```
1. バージョン未指定なら最新スナップショットのバージョンを取得
2. FTS5クエリを実行（BM25スコアリング付き）
3. 各結果に対してスニペットを抽出
4. Citation配列として返す
```

### `get_section` — セクション全文取得

**対応コード**: `src/tools/get-section.ts`

`search_spec` で見つけたセクションの全文を取得します。

```
入力: { language: "go", version: "snapshot-20260208", section_id: "Slice_types" }
出力: {
  citation: { title: "Slice types", url: "...", ... },
  content: {
    excerpt: "最初の1200文字...",
    is_truncated: true,
    fulltext_available: false,   // excerpt_onlyなので全文は非公開
  }
}
```

`source_policy` に応じて全文の公開を制御します:

```typescript
// src/tools/get-section.ts:28-51
const fulltextAvailable = section.source_policy === 'local_fulltext_ok';
// Go/Java → excerpt のみ
// Rust/TypeScript → fulltext も含めて返す
```

### `build_learning_plan` — 学習プラン生成

**対応コード**: `src/tools/build-learning-plan.ts`

仕様書のセクション一覧から、指定した週数に分割した学習プランを生成します。

```
入力: { language: "go", total_weeks: 4, focus_areas: ["Types"] }
出力: {
  weeks: [
    {
      week: 1,
      theme: "Introduction, Lexical elements",
      sections: [...],
      estimated_minutes: 45
    },
    {
      week: 2,
      theme: "Types",           // focus_areas が優先的に配置される
      sections: [...],
      estimated_minutes: 60
    },
    ...
  ]
}
```

プラン生成の流れ:

```
1. 全セクションをトップレベルトピックごとにグループ化
   groupByTopLevel(): section_path の最初の部分でグルーピング

2. focus_areas による並べ替え
   reorderForFocus(): 指定トピックを前方に移動（前提トピックは先頭維持）

3. 週への割り当て
   assignToWeeks(): コンテンツ量（文字数）で均等に分配
   ├── 目標: totalChars / totalWeeks 文字/週
   ├── 閾値超過で次の週に移行
   └── 推定時間: 800文字/分で計算
```

## 検索の深掘り: スニペット抽出

**対応コード**: `src/db/queries.ts:218-269`

FTS5 の content-sync モードでは `snippet()` 関数が使えないため、独自にスニペットを抽出しています。

```typescript
// src/db/queries.ts:218-269
export function extractRelevantSnippet(text: string, query: string, maxLen = 300) {
  // 1. テキストが十分短ければそのまま返す
  if (text.length <= maxLen) return { text, start_char: 0, end_char: text.length };

  // 2. クエリをトークンに分割（FTS5演算子を除外）
  const tokens = query.split(/\s+/)
    .filter(t => !['AND', 'OR', 'NOT', 'NEAR'].includes(t.toUpperCase()));

  // 3. テキスト内でトークンが最初に出現する位置を探す
  for (const token of tokens) {
    const pos = lowerText.indexOf(token.toLowerCase());
    if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
      bestPos = pos;
    }
  }

  // 4. その位置を中心に300文字のウィンドウを切り出す
  const half = Math.floor(maxLen / 2);
  let start = Math.max(0, bestPos - half);
  let end = start + maxLen;
}
```

動作イメージ:

```
全文（2000文字）:
"...前略... A slice is a descriptor for a contiguous segment of
an underlying array and provides access to a numbered sequence
of elements from that array. ...後略..."

クエリ: "slice"

スニペット:
"...A slice is a descriptor for a contiguous segment of an
underlying array and provides access to a numbered sequence..."
  ↑ "slice" の出現位置を中心に300文字を切り出し
```

## まとめ

- MCPは JSON-RPC 2.0 + stdio で通信する
- `console.log()` は厳禁。stdoutはJSON-RPC専用
- `ListToolsRequestSchema` でツール一覧を、`CallToolRequestSchema` でツール実行を処理
- Zodでパラメータをバリデーションし、不正な入力を拒否
- 5つのツール: メタデータ参照(2) + 全文検索 + セクション取得 + 学習プラン生成
- スニペット抽出はクエリトークンの出現位置を中心にウィンドウを切り出す

次のドキュメント [07-reliability.md](./07-reliability.md) では、信頼性を支える仕組みを解説します。
