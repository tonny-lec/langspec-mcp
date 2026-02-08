# Settings リファレンス

## 設定の階層（優先度順）

Claude Code は **5階層** の設定システムを持つ:

| 優先度 | 場所 | スコープ | バージョン管理 | 用途 |
|--------|------|---------|--------------|------|
| 1（最高） | コマンドライン引数 | セッション | N/A | 一時的なオーバーライド |
| 2 | `.claude/settings.local.json` | プロジェクト | No（git-ignored） | 個人のプロジェクト固有設定 |
| 3 | `.claude/settings.json` | プロジェクト | Yes（コミット） | チーム共有設定 |
| 4 | `~/.claude/settings.json` | ユーザー | N/A | グローバル個人設定 |
| 5（最低） | `managed-settings.json` | システム | Read-only | 組織ポリシー |

**重要な例外**:
- `deny` ルールは**最高優先度**を持ち、他の設定でオーバーライドできない
- Managed settings は**ローカル設定で上書きできない**

---

## Core Configuration（基本設定）

### 一般設定

| キー | 型 | デフォルト | 説明 |
|------|-----|----------|------|
| `model` | string | `"default"` | デフォルトモデル。エイリアス（`sonnet`, `opus`, `haiku`）またはフルモデルID |
| `language` | string | `"english"` | Claude の応答言語 |
| `cleanupPeriodDays` | number | `30` | 非アクティブセッションの削除期間 |
| `autoUpdatesChannel` | string | `"latest"` | リリースチャンネル: `"stable"` または `"latest"` |
| `alwaysThinkingEnabled` | boolean | `false` | Extended Thinking をデフォルトで有効化 |

```json
{
  "model": "opus",
  "language": "japanese",
  "cleanupPeriodDays": 60,
  "autoUpdatesChannel": "stable",
  "alwaysThinkingEnabled": true
}
```

### Plans ディレクトリ

| キー | 型 | デフォルト | 説明 |
|------|-----|----------|------|
| `plansDirectory` | string | `.claude/plans/` | `/plan` 出力の保存先 |

### Attribution 設定

Git コミットや PR への帰属表示をカスタマイズ:

```json
{
  "attribution": {
    "commit": "Generated with AI\n\nCo-Authored-By: Claude <noreply@anthropic.com>",
    "pr": "Generated with Claude Code"
  }
}
```

空文字列 `""` にすると帰属表示を非表示にできる。

### Authentication Helpers

```json
{
  "apiKeyHelper": "/bin/generate_temp_api_key.sh",
  "forceLoginMethod": "console",
  "forceLoginOrgUUID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### Company Announcements

起動時にランダム表示されるアナウンス:

```json
{
  "companyAnnouncements": [
    "Welcome to Acme Corp!",
    "Remember to run tests before committing!"
  ]
}
```

---

## Model Configuration（モデル設定）

### モデルエイリアス

| エイリアス | 説明 |
|-----------|------|
| `"default"` | アカウント種別に応じた推奨モデル |
| `"sonnet"` | 最新 Sonnet（Claude 4.5） |
| `"opus"` | 最新 Opus（Claude 4.6） |
| `"haiku"` | 高速 Haiku |
| `"sonnet[1m]"` | 1M トークンコンテキストの Sonnet |
| `"opusplan"` | Opus でプランニング、Sonnet で実行 |

### Effort Level（Opus 4.6 専用）

`/model` コマンドで Opus 4.6 選択後、← → キーで調整:

| レベル | 説明 |
|--------|------|
| High（デフォルト） | 最大の推論深度。複雑なタスク向け |
| Medium | バランス型。日常タスク向け |
| Low | 最小の推論。最速応答 |

### モデル環境変数

```json
{
  "env": {
    "ANTHROPIC_MODEL": "sonnet",
    "CLAUDE_CODE_SUBAGENT_MODEL": "haiku",
    "MAX_THINKING_TOKENS": "10000"
  }
}
```

---

## Display & UX（表示設定）

| キー | 型 | デフォルト | 説明 |
|------|-----|----------|------|
| `statusLine` | object | - | カスタムステータスライン設定 |
| `outputStyle` | string | `"default"` | 出力スタイル |
| `spinnerTipsEnabled` | boolean | `true` | 待機中の Tips 表示 |
| `spinnerVerbs` | object | - | カスタムスピナー動詞 |
| `terminalProgressBarEnabled` | boolean | `true` | ターミナルプログレスバー |
| `showTurnDuration` | boolean | `true` | ターン時間表示 |
| `respectGitignore` | boolean | `true` | ファイルピッカーで .gitignore を尊重 |

### Status Line 設定

```json
{
  "statusLine": {
    "type": "command",
    "command": "git branch --show-current 2>/dev/null || echo 'no-branch'"
  }
}
```

### カスタムスピナー（ユーモア設定）

リポジトリの例:
```json
{
  "spinnerVerbs": {
    "mode": "replace",
    "verbs": ["Admiring Shayan's code", "Learning from Shayan",
              "Studying Shayan's patterns", "Copying Shayan's genius"]
  }
}
```

`mode` は `"replace"`（完全置換）または `"append"`（既存に追加）。

---

## Sandbox 設定

Bash コマンドのサンドボックス化:

| キー | 型 | デフォルト | 説明 |
|------|-----|----------|------|
| `sandbox.enabled` | boolean | `false` | サンドボックス有効化 |
| `sandbox.autoAllowBashIfSandboxed` | boolean | `true` | サンドボックス時に Bash を自動承認 |
| `sandbox.excludedCommands` | array | `[]` | サンドボックス外で実行するコマンド |
| `sandbox.allowUnsandboxedCommands` | boolean | `true` | `dangerouslyDisableSandbox` を許可 |
| `sandbox.network.allowUnixSockets` | array | `[]` | サンドボックス内でアクセス可能な Unix ソケット |
| `sandbox.network.allowLocalBinding` | boolean | `false` | localhost へのバインドを許可 |

```json
{
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": true,
    "excludedCommands": ["git", "docker", "gh"],
    "network": {
      "allowUnixSockets": ["/var/run/docker.sock"],
      "allowLocalBinding": true
    }
  }
}
```

---

## Plugin 設定

```json
{
  "enabledPlugins": {
    "formatter@acme-tools": true,
    "deployer@acme-tools": true
  },
  "extraKnownMarketplaces": {
    "acme-tools": {
      "source": { "source": "github", "repo": "acme-corp/claude-plugins" }
    }
  }
}
```

---

## AWS & Cloud Credentials

```json
{
  "awsAuthRefresh": "aws sso login --profile myprofile",
  "awsCredentialExport": "/bin/generate_aws_grant.sh",
  "otelHeadersHelper": "/bin/generate_otel_headers.sh"
}
```

---

## 環境変数（`env` キー）

主要な環境変数:

| 変数 | 説明 |
|------|------|
| `ANTHROPIC_API_KEY` | API キー |
| `ANTHROPIC_BASE_URL` | カスタム API エンドポイント |
| `CLAUDE_CODE_USE_BEDROCK` | AWS Bedrock を使用 |
| `CLAUDE_CODE_USE_VERTEX` | Google Vertex AI を使用 |
| `MCP_TIMEOUT` | MCP 起動タイムアウト（デフォルト: 10000ms） |
| `MAX_MCP_OUTPUT_TOKENS` | MCP 出力の最大トークン（デフォルト: 50000） |
| `BASH_MAX_TIMEOUT_MS` | Bash コマンドタイムアウト |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | 自動コンパクトの閾値パーセンテージ |
| `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR` | Bash 呼び出し間の cwd 維持 |
| `ENABLE_TOOL_SEARCH` | MCP ツール検索閾値 |

---

## 便利なコマンド

| コマンド | 説明 |
|---------|------|
| `/model` | モデル切り替えと Opus 4.6 のエフォートレベル調整 |
| `/config` | インタラクティブ設定 UI |
| `/memory` | メモリファイルの表示/編集 |
| `/agents` | サブエージェント管理 |
| `/mcp` | MCP サーバー管理 |
| `/hooks` | 設定済みフックの表示 |
| `/plugin` | プラグイン管理 |
| `--doctor` | 設定の診断 |
| `--debug` | フック実行の詳細を含むデバッグモード |

---

## 出典

- [Claude Code Settings Documentation](https://code.claude.com/docs/en/settings)
