# langspec-mcp アーキテクチャ解説

プログラミング言語の仕様書をインデックス化し、AI（Claude）から全文検索・引用ができるMCPサーバの設計と実装を解説するドキュメント集です。

## 前提知識

- Node.js と npm の基本的な使い方（`npm install`, `npm run` など）
- ターミナル（コマンドライン）の基本操作
- JavaScript の基礎文法（TypeScript は本ドキュメント内で解説します）

## 読み順ガイド

| # | ファイル | 内容 | 読了目安 |
|---|---------|------|---------|
| 1 | [01-overview.md](./01-overview.md) | MCPとは何か、このサーバが解決する問題 | 10分 |
| 2 | [02-typescript-basics.md](./02-typescript-basics.md) | TypeScriptプロジェクトの構造とビルドの仕組み | 15分 |
| 3 | [03-config.md](./03-config.md) | 言語設定レジストリ — 新しい言語を追加する方法 | 10分 |
| 4 | [04-ingestion-pipeline.md](./04-ingestion-pipeline.md) | 仕様書のダウンロード・解析・保存の全工程 | 20分 |
| 5 | [05-database.md](./05-database.md) | SQLite + FTS5 によるデータベース設計 | 15分 |
| 6 | [06-mcp-server.md](./06-mcp-server.md) | MCPサーバの仕組みとツール実装 | 20分 |
| 7 | [07-reliability.md](./07-reliability.md) | 信頼性を支える仕組み（ログ・リトライ・キャッシュ） | 15分 |

各ドキュメントは独立して読めますが、番号順に読むと理解がスムーズです。

## アーキテクチャ全体図

```
┌─────────────────────────────────────────────────────────────────┐
│                        langspec-mcp                             │
│                                                                 │
│  ┌──────────┐    ┌──────────────────────────────────────────┐   │
│  │  CLI     │    │          Ingestion Pipeline              │   │
│  │ index.ts │───>│                                          │   │
│  │          │    │  fetcher ──> parser ──> normalizer ──>DB │   │
│  │ ingest   │    │  (HTTP)     (HTML/MD)   (hash/URL)       │   │
│  └──────────┘    └──────────────────────────────────────────┘   │
│       │                                        │                │
│       │                                        v                │
│       │          ┌────────────────┐    ┌──────────────┐         │
│       │          │    SQLite DB   │    │  Disk Cache  │         │
│       │          │  ┌──────────┐  │    │  data/cache/ │         │
│       │          │  │ sections │  │    └──────────────┘         │
│       │          │  │ snapshots│  │                              │
│       │          │  │ FTS5 idx │  │                              │
│       │          │  └──────────┘  │                              │
│       │          └────────────────┘                              │
│       │                  ^                                      │
│       v                  │                                      │
│  ┌──────────┐    ┌──────────────────────────────────────────┐   │
│  │  CLI     │    │           MCP Server                     │   │
│  │ index.ts │───>│                                          │   │
│  │          │    │  list_languages  search_spec              │   │
│  │  serve   │    │  list_versions   get_section              │   │
│  └──────────┘    │  build_learning_plan                      │   │
│                  └──────────────────────────────────────────┘   │
│                          │          ^                            │
└──────────────────────────│──────────│────────────────────────────┘
                           v          │
                    ┌──────────────────────┐
                    │   Claude Desktop     │
                    │   (stdin/stdout)     │
                    │                      │
                    │  JSON-RPC over stdio │
                    └──────────────────────┘
```

## 2つのコマンド

このサーバには2つの動作モードがあります:

1. **`npm run ingest`** — 仕様書をインターネットからダウンロードし、SQLiteデータベースに保存する
2. **`npm run serve`** — MCPサーバを起動し、Claude DesktopなどのAIツールに検索機能を提供する

## 対応言語

| 言語 | 仕様書 | 取得方法 | セクション数 |
|------|--------|---------|-------------|
| Go | The Go Programming Language Specification | 1ページHTML | ~162 |
| Java | Java Language Specification (SE21) | 目次+複数章HTML | ~575 |
| Rust | The Rust Reference | GitHub Markdown | ~1401 |
| TypeScript | TypeScript Handbook | GitHub Markdown | ~178 |
