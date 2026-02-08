# パーミッション

## パーミッション構造

Claude Code のパーミッションシステムは、ツールと操作に対する**きめ細かいアクセス制御**を提供する。

```json
{
  "permissions": {
    "allow": [],
    "ask": [],
    "deny": [],
    "additionalDirectories": [],
    "defaultMode": "acceptEdits",
    "disableBypassPermissionsMode": "disable"
  }
}
```

---

## パーミッションキー

| キー | 型 | 説明 |
|------|-----|------|
| `permissions.allow` | array | ユーザーに確認なしでツール使用を許可するルール |
| `permissions.ask` | array | ユーザーの確認を必要とするルール |
| `permissions.deny` | array | ツール使用をブロックするルール（**最高優先度**） |
| `permissions.additionalDirectories` | array | Claude がアクセスできる追加ディレクトリ |
| `permissions.defaultMode` | string | デフォルトのパーミッションモード |
| `permissions.disableBypassPermissionsMode` | string | バイパスモードの無効化 |

---

## パーミッションモード

| モード | 振る舞い |
|--------|---------|
| `"default"` | 標準のパーミッションチェック（プロンプト表示） |
| `"acceptEdits"` | ファイル編集を確認なしで自動承認 |
| `"askEdits"` | すべての操作で確認を要求 |
| `"viewOnly"` | 読み取り専用モード（変更不可） |
| `"bypassPermissions"` | すべてのパーミッションチェックをスキップ（**危険**） |
| `"plan"` | 読み取り専用の探索モード |

### `/config` での設定推奨

著者の推奨:
> `/config` で "don't ask" permission mode を設定する方が、`dangerously--skip-permissions` フラグより安全

---

## ツール別パーミッション構文

| ツール | 構文 | 例 |
|--------|------|-----|
| `Bash` | `Bash(command pattern)` | `Bash(npm run *)`, `Bash(git commit *)` |
| `Read` | `Read(path pattern)` | `Read(.env)`, `Read(./secrets/**)` |
| `Edit` | `Edit(path pattern)` | `Edit(src/**)`, `Edit(*.ts)` |
| `Write` | `Write(path pattern)` | `Write(*.md)`, `Write(./docs/**)` |
| `NotebookEdit` | `NotebookEdit(pattern)` | `NotebookEdit(*)` |
| `WebFetch` | `WebFetch(domain:pattern)` | `WebFetch(domain:example.com)` |
| `WebSearch` | `WebSearch` | グローバル Web 検索 |
| `Task` | `Task(agent-name)` | `Task(Explore)`, `Task(my-agent)` |
| `Skill` | `Skill(skill-name)` | `Skill(weather-fetcher)` |
| `MCP` | `mcp__server__tool` | `mcp__memory__*`, `mcp__github__*` |

---

## パターンの書き方

| パターン | マッチ対象 |
|---------|----------|
| `*` | 任意の文字列 |
| `**` | 任意のパスセグメント（再帰的） |
| `*.ts` | `.ts` で終わるファイル |
| `src/**` | `src/` 配下のすべて |
| `npm run *` | `npm run` で始まるコマンド |

---

## 実践的な設定例

### リポジトリの設定

```json
{
  "permissions": {
    "allow": [
      "Edit(*)",
      "Write(*)",
      "NotebookEdit(*)",
      "Bash",
      "WebFetch(domain:*)",
      "WebSearch",
      "mcp__*",
      "mcp__ide__*",
      "mcp__chrome-devtools__*",
      "mcp__claude-in-chrome__*",
      "mcp__playwright__*",
      "mcp__reddit-mcp-server__get_post_details"
    ],
    "deny": [],
    "ask": []
  }
}
```

**特徴**:
- ファイル編集は全許可（`Edit(*)`, `Write(*)`）
- Bash は全許可（`Bash`）
- Web アクセスは全許可（`WebFetch(domain:*)`）
- MCP ツールも全許可（`mcp__*`）
- ただし個別 MCP ツールも明示的に列挙（安全のため）

### セキュリティ重視の設定例

```json
{
  "permissions": {
    "allow": [
      "Edit(*)",
      "Write(*)",
      "Bash(npm run *)",
      "Bash(git *)",
      "WebFetch(domain:*)",
      "mcp__*"
    ],
    "ask": [
      "Bash(rm *)",
      "Bash(git push *)"
    ],
    "deny": [
      "Read(.env)",
      "Read(./secrets/**)",
      "Bash(curl *)"
    ],
    "additionalDirectories": ["../shared-libs/"]
  }
}
```

**ポイント**:
- `.env` と `secrets/` は読み取りを完全拒否
- `rm` と `git push` は確認を要求
- `curl` は完全拒否（セキュリティリスク）
- 共有ライブラリへのアクセスを追加

---

## deny の特殊な優先度

`deny` ルールは他のすべての設定を**オーバーライドする最高優先度**を持つ。

- `allow` で許可されていても `deny` があればブロックされる
- Managed settings の `deny` は**ローカル設定で解除できない**
- セキュリティ上重要なファイルの保護に使用

---

## 出典

- [Claude Code Documentation - Permissions](https://code.claude.com/docs/en/iam)
