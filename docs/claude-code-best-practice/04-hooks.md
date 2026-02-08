# Hooks システム

## Hooks とは

Hooks は Claude Code のエージェントループの **外側** で実行される **確定的スクリプト** である。
特定のイベント（ツール使用前後、セッション開始/終了など）をトリガーとして、シェルコマンドやスクリプトを実行する。

---

## Hook イベント一覧（13種類）

| イベント | 発火タイミング | Matcher対応 | 主な用途 |
|---------|--------------|-------------|---------|
| `SessionStart` | 新規/再開セッション開始時 | No | コンテキスト読み込み、環境設定 |
| `SessionEnd` | セッション終了時 | No | クリーンアップ、ログ記録 |
| `UserPromptSubmit` | ユーザーがプロンプトを送信した時 | No | 入力検証、コンテキスト追加 |
| `PreToolUse` | ツール実行前 | Yes | コマンド検証、入力変更 |
| `PostToolUse` | ツール実行成功後 | Yes | リンター実行、出力検証 |
| `PostToolUseFailure` | ツール実行失敗後 | Yes | 失敗ログ、リカバリー |
| `PermissionRequest` | パーミッションダイアログ表示時 | Yes | パターンの自動承認/拒否 |
| `Notification` | 通知送信時 | Yes | サウンドアラート、ログ |
| `Stop` | Claude が応答完了した時 | No | ブロック/続行の判断 |
| `SubagentStart` | サブエージェント生成時 | Yes | エージェント別セットアップ |
| `SubagentStop` | サブエージェント完了時 | Yes | クリーンアップ、検証 |
| `PreCompact` | コンテキスト圧縮前 | Yes | バックアップ、ログ |
| `Setup` | リポジトリ初期化時（`--init`, `--maintenance`） | Yes | 初回セットアップ |

---

## Hook の設定構造

### settings.json での設定

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/hooks.py",
            "timeout": 5000,
            "once": true
          }
        ]
      }
    ]
  },
  "disableAllHooks": false,
  "allowManagedHooksOnly": false
}
```

### プロパティの詳細

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `matcher` | string | ツール/イベントにマッチする正規表現パターン（省略可） |
| `type` | string | `"command"`（シェルコマンド）または `"prompt"`（LLM プロンプト） |
| `command` | string | 実行するシェルコマンド（`type: "command"` 時） |
| `prompt` | string | 評価用 LLM プロンプト（`type: "prompt"` 時） |
| `timeout` | number | タイムアウト（ミリ秒） |
| `once` | boolean | セッション内で1回だけ実行 |

---

## Matcher パターン

| パターン | マッチ対象 |
|---------|----------|
| `"Bash"` | Bash ツールのみ（完全一致） |
| `"Edit\|Write"` | Edit または Write（正規表現 OR） |
| `"mcp__.*"` | すべての MCP ツール |
| `"mcp__memory__.*"` | 特定 MCP サーバーのツール |
| `"*"` または `""` | すべてのツール |

---

## 終了コード

| 終了コード | 振る舞い |
|-----------|---------|
| `0` | 成功、処理続行 |
| `1` | エラー（ログ記録、処理は続行） |
| `2` | **操作をブロック**（ツールの実行を阻止） |

終了コード `2` を活用することで、特定のコマンドの実行を阻止するセーフガードを構築できる。

---

## 環境変数

Hook スクリプト内で使用可能な環境変数:

| 変数 | 説明 |
|------|------|
| `${CLAUDE_PROJECT_DIR}` | プロジェクトのルートディレクトリ |
| `CLAUDE_TOOL_NAME` | 現在のツール名 |
| `CLAUDE_TOOL_INPUT` | ツール入力（JSON） |
| `CLAUDE_TOOL_OUTPUT` | ツール出力（PostToolUse のみ） |

---

## 実装例: サウンド通知システム

リポジトリでは、Hook イベントごとに異なるサウンドを再生する**クロスプラットフォーム通知システム**を実装している。

### アーキテクチャ

```
.claude/hooks/
├── HOOKS-README.md              # ドキュメント
├── config/
│   ├── hooks-config.json        # チーム共有設定（git管理）
│   └── hooks-config.local.json  # 個人設定（git-ignored）
├── scripts/
│   ├── hooks.py                 # メインハンドラー
│   └── run-hooks-py-os-wise.sh  # OS別Pythonラッパー
└── sounds/
    ├── pretooluse/
    │   ├── pretooluse.mp3
    │   ├── pretooluse.wav
    │   ├── pretooluse-git-committing.mp3
    │   └── pretooluse-git-committing.wav
    ├── posttooluse/
    ├── notification/
    ├── stop/
    ├── sessionstart/
    ├── sessionend/
    ├── precompact/
    ├── subagentstop/
    └── userpromptsubmit/
```

### hooks.py の動作フロー

```python
def main():
    # 1. Claude からのイベントデータを stdin で受信（JSON）
    input_data = json.loads(sys.stdin.read())

    # 2. 個別 Hook の無効化チェック
    if is_hook_disabled(event_name):
        sys.exit(0)

    # 3. 再生するサウンドを決定（特殊パターンチェック含む）
    sound_name = get_sound_name(input_data)

    # 4. サウンド再生
    play_sound(sound_name)

    # 5. 常に終了コード 0（Claude の作業を中断しない）
    sys.exit(0)
```

### 特殊パターン: git commit の検出

```python
BASH_PATTERNS = [
    (r'git commit', "pretooluse-git-committing"),
]
```

`PreToolUse` イベントで `Bash` ツールが `git commit` コマンドを含む場合、通常の `pretooluse` サウンドの代わりに専用の `pretooluse-git-committing` サウンドを再生する。

### クロスプラットフォーム対応

| OS | オーディオプレイヤー |
|----|-------------------|
| macOS | `afplay`（組み込み） |
| Linux | `paplay`（PulseAudio）→ `aplay`（ALSA）→ `ffplay` → `mpg123` |
| Windows | `winsound` モジュール（WAV のみ） |

---

## Hook の有効/無効化

### 全 Hook を一括無効化

`.claude/settings.local.json`:
```json
{
  "disableAllHooks": true
}
```

### 個別 Hook の無効化

**共有設定**（`.claude/hooks/config/hooks-config.json`）:
```json
{
  "disablePreToolUseHook": false,
  "disablePostToolUseHook": false,
  "disableUserPromptSubmitHook": false,
  "disableNotificationHook": false,
  "disableStopHook": false,
  "disableSubagentStopHook": false,
  "disablePreCompactHook": false,
  "disableSessionStartHook": false,
  "disableSessionEndHook": false
}
```

**個人設定**（`.claude/hooks/config/hooks-config.local.json`）:
```json
{
  "disablePostToolUseHook": true,
  "disableSessionStartHook": true
}
```

**優先順位**: `hooks-config.local.json` > `hooks-config.json` > デフォルト（有効）

---

## settings.json での全イベント設定例

リポジトリでは、すべてのイベントに同一の Python スクリプトを紐付けている:

```json
{
  "hooks": {
    "PreToolUse":        [{ "hooks": [{ "type": "command", "command": "python3 ...", "timeout": 5000 }] }],
    "PostToolUse":       [{ "hooks": [{ "type": "command", "command": "python3 ...", "timeout": 5000 }] }],
    "UserPromptSubmit":  [{ "hooks": [{ "type": "command", "command": "python3 ...", "timeout": 5000 }] }],
    "Notification":      [{ "hooks": [{ "type": "command", "command": "python3 ...", "timeout": 5000 }] }],
    "Stop":              [{ "hooks": [{ "type": "command", "command": "python3 ...", "timeout": 5000 }] }],
    "SubagentStart":     [{ "hooks": [{ "type": "command", "command": "python3 ...", "timeout": 5000 }] }],
    "SubagentStop":      [{ "hooks": [{ "type": "command", "command": "python3 ...", "timeout": 5000 }] }],
    "PreCompact":        [{ "hooks": [{ "type": "command", "command": "python3 ...", "timeout": 5000, "once": true }] }],
    "SessionStart":      [{ "hooks": [{ "type": "command", "command": "python3 ...", "timeout": 5000, "once": true }] }],
    "SessionEnd":        [{ "hooks": [{ "type": "command", "command": "python3 ...", "timeout": 5000, "once": true }] }],
    "Setup":             [{ "hooks": [{ "type": "command", "command": "python3 ...", "timeout": 30000 }] }],
    "PermissionRequest": [{ "hooks": [{ "type": "command", "command": "python3 ...", "timeout": 5000 }] }]
  }
}
```

**注目ポイント**:
- `PreCompact`, `SessionStart`, `SessionEnd` には `"once": true` — セッション内で1回のみ実行
- `Setup` は `timeout: 30000`（30秒） — 初回セットアップは時間がかかるため
- すべて同一スクリプトにルーティングし、スクリプト内でイベントを判別

---

## ベストプラクティス

1. **常に終了コード 0 でスクリプトを終了** — Claude の作業を中断させない
2. **タイムアウトを適切に設定** — 長すぎると Claude を待たせ、短すぎると処理が中断する
3. **エラーハンドリングは stderr に出力** — stdout は Claude とのデータ交換に使われる場合がある
4. **`once: true` を活用** — セッション開始時の処理など、1回で十分なものに
5. **個人設定は `.local.json` に分離** — チーム設定を汚染しない

---

## TTS サウンド生成

リポジトリのサウンドファイルは [ElevenLabs](https://elevenlabs.io/) の TTS で生成されている（ボイス: Samara X）。

---

## 出典

- [Claude Code Documentation - Hooks](https://code.claude.com/docs/en/hooks)
