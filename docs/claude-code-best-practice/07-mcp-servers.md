# MCP サーバー

## MCP (Model Context Protocol) とは

MCP は Claude Code が**外部ツール・データベース・API** と接続するためのプロトコルである。
MCP サーバーを設定することで、Claude がブラウザ操作、データベースアクセス、外部サービスとの連携を行えるようになる。

---

## MCP サーバーの設定

### .mcp.json

プロジェクトルートの `.mcp.json` でプロジェクト単位の MCP サーバーを定義:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp"]
    },
    "reddit-mcp-server": {
      "type": "http",
      "url": "http://144.91.76.33:8080/mcp"
    },
    "figma": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp"
    }
  }
}
```

### MCP サーバーの種類

| 種類 | 設定方法 | 例 |
|------|---------|-----|
| **ローカル実行型** | `command` + `args` | Playwright MCP（npx で起動） |
| **HTTP 接続型** | `type: "http"` + `url` | Figma MCP、Reddit MCP |

---

## Settings での MCP 設定

| キー | 型 | スコープ | 説明 |
|------|-----|---------|------|
| `enableAllProjectMcpServers` | boolean | 任意 | `.mcp.json` の全サーバーを自動承認 |
| `enabledMcpjsonServers` | array | 任意 | 特定サーバー名を許可リストに追加 |
| `disabledMcpjsonServers` | array | 任意 | 特定サーバー名をブロックリストに追加 |
| `allowedMcpServers` | array | Managed のみ | 名前/コマンド/URL でのマッチング許可リスト |
| `deniedMcpServers` | array | Managed のみ | 名前/コマンド/URL でのマッチングブロックリスト |

### Managed Settings でのマッチング

組織レベルで MCP サーバーを制御:

```json
{
  "allowedMcpServers": [
    { "serverName": "github" },
    { "serverCommand": "npx @modelcontextprotocol/*" },
    { "serverUrl": "https://mcp.company.com/*" }
  ],
  "deniedMcpServers": [
    { "serverName": "dangerous-server" }
  ]
}
```

---

## MCP サーバーの追加方法

### CLI コマンドでの追加

```bash
# Playwright MCP（ユーザースコープ = 全プロジェクト）
claude mcp add playwright -s user -- npx @playwright/mcp@latest

# Chrome DevTools MCP
claude mcp add chrome-devtools -s user -- npx chrome-devtools-mcp@latest
```

`-s user` を指定するとグローバル設定に追加され、すべてのプロジェクトで利用可能になる。

### .mcp.json での追加

プロジェクト固有の MCP サーバーは `.mcp.json` に直接記載する。

---

## MCP 関連の環境変数

| 変数 | デフォルト | 説明 |
|------|----------|------|
| `MCP_TIMEOUT` | 10000 | MCP 起動タイムアウト（ミリ秒） |
| `MAX_MCP_OUTPUT_TOKENS` | 50000 | MCP 出力の最大トークン数 |
| `ENABLE_TOOL_SEARCH` | - | MCP ツール検索閾値（例: `auto:5`） |

---

## Permission での MCP ツール制御

MCP ツールは `mcp__<server>__<tool>` の形式で Permission ルールに使用:

```json
{
  "permissions": {
    "allow": [
      "mcp__*",                                  // 全 MCP ツール
      "mcp__playwright__*",                      // Playwright の全ツール
      "mcp__reddit-mcp-server__get_post_details" // Reddit の特定ツール
    ]
  }
}
```

---

## MCP 管理コマンド

```bash
# MCP サーバー一覧
/mcp

# MCP サーバーの追加
claude mcp add <name> -s <scope> -- <command>

# MCP サーバーの削除
claude mcp remove <name>
```

---

## 出典

- [Claude Code Documentation - MCP](https://code.claude.com/docs/en/mcp)
