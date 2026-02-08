# 01: 全体像 — MCPとこのサーバの目的

## このドキュメントで学ぶこと

- MCPプロトコルとは何か
- langspec-mcp が解決する問題
- 2つのコマンド（`ingest` と `serve`）の役割
- プロジェクト全体の構成

## MCPプロトコルとは何か

**MCP (Model Context Protocol)** は、AIアシスタント（Claude Desktopなど）が外部のツールやデータにアクセスするための標準プロトコルです。

通常、AIは学習時のデータしか知りません。しかしMCPを使うと、AIが「ツール」を呼び出して、リアルタイムのデータを取得したり、外部システムを操作したりできるようになります。

```
┌───────────────────┐          ┌───────────────────┐
│   Claude Desktop  │  JSON-RPC │   MCP Server      │
│                   │<========>│  (langspec-mcp)    │
│  「Goのスライスに  │  stdin/   │                   │
│   ついて教えて」   │  stdout   │  SQLite DB から    │
│                   │          │  仕様書を検索       │
└───────────────────┘          └───────────────────┘
```

MCPの仕組みはシンプルです:

1. AIが「どんなツールがあるか？」と聞く → サーバがツール一覧を返す
2. AIがツールを呼ぶ（例: `search_spec("slice types", "go")`）
3. サーバがDBを検索し、結果をAIに返す
4. AIがその結果を使って回答を組み立てる

## langspec-mcp が解決する問題

AIは言語仕様について質問されたとき、学習データから「なんとなく」回答します。しかし:

- 仕様書の正確な文面を引用できない
- どのバージョンの仕様かわからない
- 仕様書のどのセクションに書いてあるかリンクを示せない

langspec-mcp は、プログラミング言語の公式仕様書をデータベースに取り込み、AIが正確に検索・引用できるようにします。

## 2つのコマンド

### `ingest` — 仕様書をデータベースに取り込む

```
npm run ingest -- --language go
```

このコマンドは以下の処理を行います:

```
インターネット上の仕様書
        │
        v
  ┌─────────────┐
  │  ダウンロード │  fetcher.ts
  │  (HTTP取得)   │
  └──────┬──────┘
         v
  ┌─────────────┐
  │  解析        │  parser.ts
  │  (HTML/MD→   │
  │   セクション) │
  └──────┬──────┘
         v
  ┌─────────────┐
  │  正規化      │  normalizer.ts
  │  (URL,hash)  │
  └──────┬──────┘
         v
  ┌─────────────┐
  │  DB保存      │  ingestion/index.ts
  │  (SQLite)    │
  └─────────────┘
```

### `serve` — MCPサーバを起動する

```
npm run serve
```

起動すると、標準入力（stdin）と標準出力（stdout）を使って JSON-RPC で通信します。Claude Desktop の設定ファイルにこのサーバを登録すると、AIが自動的にツールを認識して使えるようになります。

## 対応コード

エントリーポイントは `src/index.ts` です。`main()` 関数内の `switch` 文で `ingest` と `serve` を切り替えています:

```typescript
// src/index.ts:36-78
switch (command) {
  case 'ingest': {
    // --language フラグを解析し、仕様書を取り込む
    const language = parseLanguageFlag(process.argv.slice(3));
    // ...
    await ingestSpec(db, language, CACHE_DIR);
    break;
  }

  case 'serve': {
    // MCPサーバを起動（stdin/stdoutで待ち受け）
    const db = initializeDatabase(DB_PATH);
    await startServer(db);
    break;
  }
}
```

- **データベースファイル**: `data/langspec.db`
- **キャッシュディレクトリ**: `data/cache/`

どちらも `data/` ディレクトリに配置され、`.gitignore` で管理対象外になっています。

## まとめ

- MCPは、AIが外部ツールと会話するための標準プロトコル
- langspec-mcp は仕様書をDBに取り込み（`ingest`）、AIに検索ツールを提供する（`serve`）
- 通信はstdin/stdout上のJSON-RPCで行われる

次のドキュメント [02-typescript-basics.md](./02-typescript-basics.md) では、このプロジェクトのTypeScript構成を解説します。
