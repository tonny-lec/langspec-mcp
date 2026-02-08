# 02: TypeScript プロジェクトの仕組み

## このドキュメントで学ぶこと

- `package.json` の役割と主要フィールドの意味
- `tsconfig.json` の設定とその理由
- TypeScript のビルドの流れ
- ES Modules と `"type": "module"` の意味
- なぜインポートに `.js` 拡張子を書くのか

## package.json — プロジェクトの設計図

`package.json` はNode.jsプロジェクトの中心ファイルです。プロジェクト名、使用するライブラリ、実行コマンドなどを定義します。

### dependencies と devDependencies

```json
// package.json:26-37
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.26.0",
  "better-sqlite3": "^11.8.1",
  "cheerio": "^1.0.0",
  "zod": "^3.24.1"
},
"devDependencies": {
  "@types/better-sqlite3": "^7.6.12",
  "@types/node": "^22.10.5",
  "typescript": "^5.7.2",
  "vitest": "^4.0.18"
}
```

| 区分 | 説明 | 例 |
|------|------|-----|
| **dependencies** | 実行時に必要なライブラリ | MCP SDK, SQLite, cheerio, zod |
| **devDependencies** | 開発時のみ必要なライブラリ | TypeScript コンパイラ, 型定義, テストツール |

`npm install` を実行すると、両方がインストールされます。本番デプロイ時には `npm install --production` で dependencies だけをインストールできます。

### npm scripts

```json
// package.json:11-17
"scripts": {
  "build": "tsc",
  "dev": "tsc --watch",
  "ingest": "node dist/index.js ingest",
  "serve": "node dist/index.js serve",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

| コマンド | 実行されるもの | 説明 |
|---------|-------------|------|
| `npm run build` | `tsc` | TypeScript → JavaScript にコンパイル |
| `npm run dev` | `tsc --watch` | ファイル変更を検知して自動コンパイル |
| `npm run ingest` | `node dist/index.js ingest` | コンパイル済みJSで取り込み実行 |
| `npm run serve` | `node dist/index.js serve` | コンパイル済みJSでサーバ起動 |
| `npm test` | `vitest run` | テストを1回実行 |

ポイント: `npm run ingest` は `dist/index.js` を実行しています。`src/index.ts` ではありません。TypeScript ファイルは直接実行できず、まずコンパイルが必要です。

## tsconfig.json — TypeScript コンパイラの設定

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

重要な設定を順番に解説します:

### `"target": "ES2022"`

コンパイル後のJavaScriptがどのバージョンの文法を使うかを指定します。ES2022 は `Array.at()` や `Object.hasOwn()` などのモダンな機能を含みます。Node.js 18以上で動作します。

### `"module": "Node16"` と `"moduleResolution": "Node16"`

**これが最も初心者がつまずくポイントです。**

Node.js には2つのモジュールシステムがあります:

```
CommonJS (古い方式):           ES Modules (新しい方式):
const fs = require('fs');     import fs from 'node:fs';
module.exports = { ... };     export function foo() { ... }
```

このプロジェクトは ES Modules を使っています。`"module": "Node16"` は「Node.js 16以降のES Modulesルールに従え」という意味です。

### なぜインポートに `.js` を書くのか？

```typescript
// src/index.ts:6-10
import { initializeDatabase } from './db/schema.js';    // ← .js!
import { ingestSpec } from './ingestion/index.js';       // ← .js!
import { startServer } from './server.js';               // ← .js!
```

ソースコードは `.ts` ファイルなのに、インポートパスには `.js` と書きます。これは一見おかしく見えますが、理由があります:

```
コンパイル前:                      コンパイル後:
src/db/schema.ts         ──tsc──>  dist/db/schema.js
src/index.ts             ──tsc──>  dist/index.js
  import from './db/schema.js'       import from './db/schema.js'
  （.jsのまま出力される）              （実際に.jsファイルがある → OK!）
```

TypeScript コンパイラ（tsc）は **インポートパスを書き換えません**。だから、コンパイル後に実際に存在するファイル名（`.js`）をあらかじめ書いておく必要があるのです。

### `"outDir": "./dist"` と `"rootDir": "./src"`

```
コンパイル前:              コンパイル後:
src/                      dist/
├── index.ts       ──>    ├── index.js
├── server.ts      ──>    ├── server.js
├── db/            ──>    ├── db/
│   └── schema.ts  ──>    │   └── schema.js
└── ...            ──>    └── ...
```

`src/` 内の `.ts` ファイルが `dist/` 内の `.js` ファイルに変換されます。ディレクトリ構造はそのまま維持されます。

## `"type": "module"` の意味

```json
// package.json:5
"type": "module"
```

この1行が package.json にあると、Node.js はプロジェクト内の `.js` ファイルをすべて ES Modules として扱います。これがないと CommonJS として扱われ、`import`/`export` 構文が使えません。

## ビルドの流れ まとめ

```
1. npm run build を実行
        │
        v
2. tsc（TypeScriptコンパイラ）が起動
        │
        v
3. tsconfig.json を読み込み
   - src/ 内の全 .ts ファイルを対象
   - 型チェックを実行（strict: true）
        │
        v
4. 問題なければ dist/ に .js ファイルを出力
   - .js       : 実行可能なJavaScript
   - .d.ts     : 型定義ファイル（ライブラリとして使う場合用）
   - .js.map   : ソースマップ（デバッグ時にTSの行番号を表示）
        │
        v
5. node dist/index.js で実行可能に
```

## まとめ

- `package.json` はプロジェクトの設計図。ライブラリとスクリプトを管理する
- TypeScript は直接実行できない。`tsc` でコンパイルしてから `node` で実行する
- `"module": "Node16"` + `"type": "module"` で ES Modules を使用
- インポートに `.js` を書くのは、コンパイル後のファイル名に合わせるため

次のドキュメント [03-config.md](./03-config.md) では、言語設定の仕組みを解説します。
