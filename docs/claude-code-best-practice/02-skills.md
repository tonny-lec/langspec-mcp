# Skills システム

## Skills とは

Skills は Claude Code に**再利用可能な知識・ワークフロー・スラッシュコマンド**を提供する仕組みである。
`.claude/skills/<skill-name>/SKILL.md` に配置し、`/skill-name` で呼び出すか、Claude が自動的に検出して利用する。

従来の `.claude/commands/` に置いていた Custom Slash Commands は Skills に統合された。

---

## Skill の定義構造

### ファイル配置

```
.claude/skills/<skill-name>/SKILL.md
```

### YAML フロントマター

```yaml
---
name: weather-fetcher              # スキル識別子（省略時はディレクトリ名）
description: Instructions for...   # 自動検出時に使われる説明
model: haiku                       # スキル実行時に使用するモデル
disable-model-invocation: false    # true にすると自動呼び出しを防止
context: fork                      # fork にすると分離されたサブエージェントコンテキストで実行
allowed-tools: WebFetch, Read      # Claude が使えるツールを制限
---
```

### フロントマターの各プロパティ

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `name` | string | スキル識別子。省略時はディレクトリ名が使用される |
| `description` | string | いつこのスキルを呼び出すかの説明。自動検出（Auto-discovery）に推奨 |
| `model` | string | スキル実行時のモデル（`haiku`, `sonnet`, `opus`） |
| `disable-model-invocation` | boolean | `true` にするとユーザーが明示的に `/skill-name` で呼び出さない限り実行されない |
| `context` | string | `fork` を指定すると分離されたサブエージェントコンテキストで実行 |
| `allowed-tools` | string | カンマ区切りで使用可能なツールを制限 |

---

## Skill の配置場所（スコープ）

| スコープ | パス | 適用範囲 |
|---------|------|---------|
| Enterprise | マネージド設定 | 組織内全ユーザー |
| Personal | `~/.claude/skills/<name>/SKILL.md` | 自分の全プロジェクト |
| Project | `.claude/skills/<name>/SKILL.md` | このプロジェクトのみ |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | プラグインが有効な箇所 |

---

## Skill のロード方式

### Description のみロード vs 全文ロード

- **Description（説明文）**: コンテキストに常にロードされる（文字数バジェット内）
  - Claude が「何が利用可能か」を知るため
- **Full Content（全文）**: スキルが呼び出された時点でオンデマンドにロード
  - 不必要なコンテキスト消費を防ぐ最適化

> **例外**: サブエージェントに `skills:` フィールドで事前ロードされたスキルは、**起動時に全文がコンテキストに注入** される。

### 文字数バジェット

スキルの description はデフォルトで **15,000文字** のバジェット内でコンテキストにロードされる。

- `/context` コマンドで除外されたスキルの警告を確認可能
- `SLASH_COMMAND_TOOL_CHAR_BUDGET` 環境変数でバジェットを変更可能

---

## 自動検出（Automatic Discovery）

### ネストされたディレクトリからの自動検出

サブディレクトリのファイルを操作すると、そのディレクトリにある `.claude/skills/` も自動的に検出される。

```
/mymonorepo/
├── .claude/skills/
│   └── shared-conventions/SKILL.md    # プロジェクトレベル
├── packages/
│   ├── frontend/
│   │   ├── .claude/skills/
│   │   │   └── react-patterns/SKILL.md  # frontend 固有
│   │   └── src/App.tsx
│   └── backend/
│       ├── .claude/skills/
│       │   └── api-design/SKILL.md      # backend 固有
│       └── src/
```

**動作**:
1. 起動直後は `shared-conventions` のみコンテキストに存在
2. `packages/frontend/src/App.tsx` を編集すると `react-patterns` が検出される
3. `backend/` のファイルに触れない限り `api-design` は検出されない

---

## 具体例: Weather Fetcher Skill

```yaml
---
name: weather-fetcher
description: Instructions for fetching current weather temperature data
              for Karachi, Pakistan from wttr.in API
---
```

```markdown
# Weather Fetcher Skill

## Task
Fetch the current temperature for Karachi, Pakistan in degrees Celsius.

## Instructions
1. Use WebFetch tool to get data from `https://wttr.in/Karachi?format=j1`
2. Extract temperature from `current_condition` section
3. Keep the value for the next step

## Expected Output
Current Karachi Temperature: [X]°C
Status: Successfully fetched weather data
```

**ポイント**:
- 明確なタスク定義
- ステップバイステップの手順
- 期待される出力形式の指定

---

## Skill の優先順位

同名のスキルが複数のスコープに存在する場合:

| 優先度 | スコープ |
|--------|---------|
| 1（最高） | Enterprise |
| 2 | Personal (`~/.claude/skills/`) |
| 3（最低） | Project (`.claude/skills/`) |

Plugin スキルは `plugin-name:skill-name` の名前空間を使うため、他のレベルとの競合は発生しない。

---

## Skills vs CLAUDE.md のロード方式比較

| 振る舞い | CLAUDE.md | Skills |
|---------|-----------|--------|
| 祖先ロード（上方向） | Yes | No |
| 子孫検出（下方向） | Yes（遅延） | Yes（自動検出） |
| グローバル配置 | `~/.claude/CLAUDE.md` | `~/.claude/skills/` |
| プロジェクト配置 | `.claude/` またはリポジトリルート | `.claude/skills/` |
| コンテンツロード | 全文 | Description のみ（呼び出し時に全文） |

---

## ベストプラクティス

1. **共有ワークフローはルート `.claude/skills/` に配置** — リポジトリ全体で使う規約やパターン
2. **パッケージ固有のスキルはパッケージ配下に配置** — チーム間の調整不要で独立管理
3. **危険なスキルには `disable-model-invocation: true`** — デプロイや破壊的操作は明示的な `/skill-name` 呼び出しを要求
4. **description は簡潔に** — コンテキストバジェットを消費するため冗長な説明を避ける
5. **スキル名にプレフィックスを使う** — `frontend-review`, `backend-deploy` のように名前空間を意識

---

## 出典

- [Claude Code Documentation - Skills](https://code.claude.com/docs/en/skills)
- [Claude Code Documentation - Automatic Discovery](https://code.claude.com/docs/en/skills#automatic-discovery-from-nested-directories)
