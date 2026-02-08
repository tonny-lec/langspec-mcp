# 07: 信頼性を支える仕組み (NFR)

## このドキュメントで学ぶこと

- 構造化ログの仕組みと使い方
- リトライ（自動再試行）の戦略
- ディスクキャッシュによる通信量削減
- 適応的レート制限の動作

NFR (Non-Functional Requirements = 非機能要件) とは、「正しく動く」だけでなく「安定して動く」「壊れにくい」「効率的に動く」といった品質に関する要件です。

## 構造化ログ

**対応コード**: `src/lib/logger.ts`

### なぜ構造化ログか

通常のログ:
```
[2026-02-08 12:00:00] INFO: Fetching https://go.dev/ref/spec
[2026-02-08 12:00:01] ERROR: Failed to fetch: 429 Too Many Requests
```

構造化ログ（JSON Lines）:
```json
{"ts":"2026-02-08T12:00:00.000Z","level":"info","component":"Fetcher","msg":"Fetching","url":"https://go.dev/ref/spec"}
{"ts":"2026-02-08T12:00:01.000Z","level":"error","component":"Fetcher","msg":"Failed to fetch","status":429,"url":"https://go.dev/ref/spec"}
```

構造化ログの利点:

- **プログラムで解析しやすい**: JSON.parse() で読み込み、フィルタリングや集計ができる
- **grep しやすい**: `grep '"level":"error"'` でエラーだけ抽出
- **コンポーネント別に追跡**: `component` フィールドでどのモジュールのログか一目瞭然

### 実装

```typescript
// src/lib/logger.ts:34-60
export function createLogger(component: string): Logger {
  function log(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    // ログレベルフィルタ: 設定レベル未満は出力しない
    if (LEVEL_ORDER[level] < LEVEL_ORDER[globalLevel]) return;

    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      component,
      msg,
    };

    // 追加データをマージ
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        entry[key] = value;
      }
    }

    // stderrに出力（stdoutはJSON-RPC通信用なので使えない！）
    process.stderr.write(JSON.stringify(entry) + '\n');
  }

  return {
    debug: (msg, data?) => log('debug', msg, data),
    info:  (msg, data?) => log('info', msg, data),
    warn:  (msg, data?) => log('warn', msg, data),
    error: (msg, data?) => log('error', msg, data),
  };
}
```

### 使い方

```typescript
// 各モジュールの冒頭で作成
const log = createLogger('Fetcher');   // src/ingestion/fetcher.ts:8
const log = createLogger('Parser');    // src/ingestion/parser.ts:6
const log = createLogger('DB');        // src/db/schema.ts:5
const log = createLogger('Server');    // src/server.ts:10

// ログ出力
log.info('Fetching', { url: 'https://go.dev/ref/spec' });
log.warn('Rate limited', { status: 429, retryAfter: 5 });
log.error('Fatal error', { error: 'Connection refused' });
```

### ログレベル制御

```typescript
// src/lib/logger.ts:3-8
const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,   // 最も詳細（通常は非表示）
  info: 1,    // 通常の情報（デフォルト）
  warn: 2,    // 警告
  error: 3,   // エラー
};
```

環境変数 `LOG_LEVEL` で出力レベルを制御します:

```bash
# 通常実行（infoレベル以上を表示）
npm run ingest -- --language go

# デバッグ実行（全レベルを表示）
LOG_LEVEL=debug npm run ingest -- --language go

# エラーのみ表示
LOG_LEVEL=error npm run ingest -- --language go
```

`LOG_LEVEL=debug` に設定すると、各ページの取得状況や解析結果など、詳細な情報が表示されます。

## リトライ（自動再試行）

**対応コード**: `src/lib/retry.ts`

HTTP通信は失敗することがあります。サーバが一時的にダウンしていたり、レート制限に引っかかったりする場合です。

### `withRetry()` — リトライラッパー

```typescript
// src/lib/retry.ts:36-77
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxRetries = opts.maxRetries ?? 3;
  const initialDelayMs = opts.initialDelayMs ?? 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;  // リトライ不可 or 上限到達 → 諦める
      }

      // 待機時間を計算して待つ
      const delayMs = jitter(initialDelayMs * Math.pow(2, attempt));
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
```

使い方はシンプルです。非同期関数を `withRetry()` で囲むだけです:

```typescript
// src/ingestion/fetcher.ts:34-63
async function fetchUrl(url: string, knownEtag?: string): Promise<FetchUrlResult> {
  return withRetry(async () => {
    const response = await fetch(url, { ... });
    if (!response.ok) {
      throw new FetchError(...);
    }
    return { body: await response.text(), etag, status: 200 };
  });
}
```

### 指数バックオフ + ジッター

リトライの待機時間は「指数バックオフ」で増加します:

```
試行1失敗 → 約1秒待つ  (1000ms × 2^0 = 1000ms)
試行2失敗 → 約2秒待つ  (1000ms × 2^1 = 2000ms)
試行3失敗 → 約4秒待つ  (1000ms × 2^2 = 4000ms)
試行4失敗 → 諦める
```

さらに「ジッター（ゆらぎ）」を±25%加えます:

```typescript
// src/lib/retry.ts:30-34
function jitter(baseMs: number): number {
  const factor = 0.75 + Math.random() * 0.5;  // 0.75 〜 1.25
  return Math.round(baseMs * factor);
}
```

```
1000ms × ジッター → 750ms 〜 1250ms の間でランダム
```

なぜジッターを入れるのか？ 複数のクライアントが同時にリトライすると、同じタイミングでサーバに殺到してしまいます（「サンダリングハード問題」）。ジッターでタイミングをずらすことで、この問題を避けられます。

### リトライ判定

すべてのエラーをリトライするわけではありません:

```typescript
// src/lib/retry.ts:11-28
function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof FetchError) {
    if (error.status === 429) return true;   // Too Many Requests → リトライ
    if (error.status >= 500) return true;     // サーバエラー → リトライ
    return false;                             // 404など → リトライしない
  }
  if (error instanceof TypeError) return true; // DNS/接続エラー → リトライ
  return false;
}
```

| ステータス | 判定 | 理由 |
|-----------|------|------|
| 429 | リトライする | 一時的なレート制限 |
| 500-599 | リトライする | サーバ側の一時的な問題 |
| 404 | リトライしない | ページが存在しない（何度やっても同じ） |
| TypeError | リトライする | DNS解決失敗や接続エラー（一時的な可能性） |

### `Retry-After` ヘッダー対応

429 応答には `Retry-After` ヘッダーが含まれることがあります。「この秒数待ってから再試行して」という指示です:

```typescript
// src/lib/retry.ts:58-63
if (error instanceof FetchError && error.retryAfter != null) {
  delayMs = error.retryAfter * 1000;  // サーバの指示に従う
} else {
  delayMs = jitter(initialDelayMs * Math.pow(2, attempt));  // 指数バックオフ
}
```

### `FetchError` クラス

```typescript
// src/lib/retry.ts:79-89
export class FetchError extends Error {
  constructor(
    message: string,
    public readonly url: string,       // 失敗したURL
    public readonly status: number,    // HTTPステータスコード
    public readonly retryAfter?: number, // Retry-Afterヘッダーの値（秒）
  ) {
    super(message);
    this.name = 'FetchError';
  }
}
```

通常の `Error` を拡張し、HTTP固有の情報（URL, ステータスコード, Retry-After）を保持します。リトライ判定やログ出力で使われます。

## ディスクキャッシュ

**対応コード**: `src/lib/cache.ts`

2回目以降の `ingest` では、前回ダウンロードした内容をディスクにキャッシュして再利用します。

### キャッシュの仕組み

```
初回 ingest:
  fetch(url) → 200 OK → HTMLをDBに保存 + キャッシュに保存

2回目 ingest:
  fetch(url, If-None-Match: "前回のETag")
  → 304 Not Modified → キャッシュから読み込み（ダウンロード不要！）
  → 200 OK → 新しい内容でキャッシュを更新
```

### ファイル構造

```
data/cache/
├── go/
│   └── go-spec/
│       ├── a1b2c3d4e5f6g7h8.html        ← キャッシュ本体
│       └── a1b2c3d4e5f6g7h8.meta.json   ← メタデータ（ETag, URL, 取得日時）
├── java/
│   └── jls/
│       ├── 1234abcd5678efgh.html
│       ├── 1234abcd5678efgh.meta.json
│       └── ...（各章ごとにファイル）
└── ...
```

ファイル名はURLのSHA-256ハッシュの先頭16文字です:

```typescript
// src/lib/cache.ts:22-24
private keyFor(url: string): string {
  return createHash('sha256').update(url).digest('hex').substring(0, 16);
}
```

### メタデータ

```json
// .meta.json の例
{
  "url": "https://go.dev/ref/spec",
  "etag": "\"abc123\"",
  "fetchedAt": "2026-02-08T03:00:00.000Z"
}
```

### キャッシュの利用

```typescript
// src/ingestion/fetcher.ts:72-93
async function fetchWithCache(url: string, ctx?: CacheContext): Promise<FetchUrlResult> {
  // 1. キャッシュからETagを取得
  const cachedEtag = ctx?.cache.getMeta(ctx.language, ctx.doc, url)?.etag;

  // 2. ETag付きでHTTPリクエスト
  const result = await fetchUrl(url, cachedEtag);

  // 3. 304 Not Modified → キャッシュから読み込み
  if (result.status === 304 && ctx) {
    const cached = ctx.cache.getContent(ctx.language, ctx.doc, url);
    if (cached != null) {
      return { body: cached, etag: result.etag, status: 304 };
    }
  }

  // 4. 200 OK → キャッシュを更新
  if (result.status === 200 && result.body != null && ctx) {
    ctx.cache.put(ctx.language, ctx.doc, url, result.body, result.etag);
  }

  return result;
}
```

### 効果

```
初回 ingest (Java JLS):
  19章 × 平均100KB = 約1.9MB ダウンロード
  所要時間: 約30秒

2回目 ingest (変更なし):
  19章 × HEAD相当リクエスト = ほぼ0KB
  所要時間: 約5秒
```

## 適応的レート制限

**対応コード**: `src/ingestion/fetcher.ts:16-25`

マルチページ取得時に 429 (Too Many Requests) を受け取ったら、リクエスト間の遅延を自動的に増やします。

```typescript
// src/ingestion/fetcher.ts:16-25
export function adaptDelay(currentDelayMs: number, error: unknown): number {
  if (error instanceof FetchError && error.status === 429) {
    const newDelay = error.retryAfter != null
      ? error.retryAfter * 1000                    // Retry-After に従う
      : Math.min(currentDelayMs * 2, 10_000);      // なければ倍増（上限10秒）
    return newDelay;
  }
  return currentDelayMs;  // 429以外はそのまま
}
```

動作の流れ:

```
ページ1: 200ms待って取得 → OK
ページ2: 200ms待って取得 → OK
ページ3: 200ms待って取得 → 429! (リトライで成功)
                              ↓
          delayMs を 200ms → 400ms に増加
                              ↓
ページ4: 400ms待って取得 → OK
ページ5: 400ms待って取得 → OK
...
```

取得ループ内での使用:

```typescript
// src/ingestion/fetcher.ts:160-176（multi-html-toc の例）
let delayMs = 200;
for (const link of chapterLinks) {
  try {
    const result = await fetchWithCache(chapterUrl, ctx);
    results.push(result);
  } catch (err) {
    errors.push({ url: chapterUrl, error: msg });
    delayMs = adaptDelay(delayMs, err);  // 429なら遅延を増加
  }
  await delay(delayMs);
}
```

## タイムアウト

すべてのHTTPリクエストに30秒のタイムアウトを設定しています:

```typescript
// src/ingestion/fetcher.ts:10-11
const FETCH_TIMEOUT_MS = 30_000;

// src/ingestion/fetcher.ts:42
const response = await fetch(url, {
  signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
});
```

`AbortSignal.timeout()` は Node.js 18 以降で使える機能です。指定時間内に応答がなければリクエストを中断し、`AbortError` をスローします。これもリトライ対象です（`src/lib/retry.ts:25`）。

## まとめ

| 仕組み | 目的 | 対応コード |
|--------|------|-----------|
| 構造化ログ | 問題の追跡と診断 | `src/lib/logger.ts` |
| リトライ | 一時的な障害からの自動復旧 | `src/lib/retry.ts` |
| ディスクキャッシュ | 通信量の削減と高速化 | `src/lib/cache.ts` |
| 適応的レート制限 | サーバへの過負荷防止 | `src/ingestion/fetcher.ts` |
| タイムアウト | ハングアップ防止 | `src/ingestion/fetcher.ts` |

これらの仕組みが連携して、ネットワーク障害やサーバの一時的な問題があっても、可能な限り処理を継続し、回復できるようにしています。
