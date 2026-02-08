# Commands

## Commands とは

Commands は Claude Code における**ユーザー操作のエントリーポイント**である。
`.claude/commands/<command-name>.md` にマークダウンファイルとして配置し、`/command-name` で呼び出す。

> **注意**: Custom slash commands は Skills に統合された。`.claude/commands/` のファイルは引き続き動作するが、Skills（`.claude/skills/`）の使用が推奨される。ただし、Commands は引き続きワークフローのエントリーポイントとして有効。

---

## Command の定義構造

### ファイル配置

```
.claude/commands/<command-name>.md
```

サブディレクトリも使用可能:
```
.claude/commands/rpi/research.md   → /rpi:research
.claude/commands/rpi/plan.md       → /rpi:plan
.claude/commands/rpi/implement.md  → /rpi:implement
```

### YAML フロントマター

```yaml
---
description: Fetch and transform weather data for Karachi
model: haiku
argument-hint: "<feature-slug>"
---
```

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `description` | string | コマンドの説明 |
| `model` | string | コマンド実行時に使用するモデル |
| `argument-hint` | string | ユーザーに対する引数のヒント |

---

## Commands vs Agents vs Skills

| 観点 | Commands | Agents (Subagents) | Skills |
|------|----------|--------------------|--------|
| **役割** | エントリーポイント | ワークフロー実行 | ドメイン知識 |
| **呼び出し方** | `/command-name` | Task ツール | `/skill-name` または自動 |
| **コンテキスト** | メインコンテキスト | 分離されたコンテキスト | メインまたは分離 |
| **他コンポーネントの呼び出し** | Agent/Skill を呼び出し可能 | Skill を事前ロード可能 | 単体で動作 |
| **推奨用途** | ワークフローの起点 | 並列/分離実行 | 再利用可能な知識 |

### 著者の推奨

> **ワークフローには agents ではなく commands を使う**

Commands がワークフローの安定したエントリーポイントとなり、そこから必要に応じて Agent や Skill を呼び出すパターンが最も安定する。

---

## 具体例: Weather Orchestrator Command

```yaml
---
description: Fetch and transform weather data for Karachi
model: haiku
---
```

```markdown
# Weather Orchestrator Command

Fetch the current temperature for Karachi, Pakistan and apply transformations.

## Workflow

1. Use the AskUserQuestion tool to ask the user whether they want
   the temperature in Celsius or Fahrenheit
2. Use the weather agent to fetch and transform the temperature data

## Agent Invocation

Use the Task tool to invoke the weather agent:
- subagent_type: weather
- description: Fetch and transform Karachi weather
- prompt: Fetch the current temperature for Karachi, Pakistan in [unit].
  Then apply the transformation rules from weather-orchestration/input.md
  and write the results to weather-orchestration/output.md.
- model: haiku

## Critical Requirements

1. **Use Task Tool Only**: DO NOT use bash commands to invoke agents.
2. **Single Agent**: The weather agent handles both fetching and transformation.
3. **Pass User Preference**: Include the user's temperature unit preference.
```

**設計のポイント**:
- Command はユーザーとのインタラクション（質問）を担当
- 実際の処理は Agent に委譲
- Task ツールでの呼び出しを明示的に指定（Bash での呼び出しを禁止）

---

## RPI ワークフローの Commands

RPI ワークフローでは3つのコマンドを定義:

### `/rpi:research <feature-slug>`

- **目的**: 機能の実現可能性を調査し GO/NO-GO 判断
- **使用エージェント**: requirement-parser → product-manager → Explore → senior-software-engineer → technical-cto-advisor → documentation-analyst-writer
- **出力**: `rpi/{feature-slug}/research/RESEARCH.md`

### `/rpi:plan <feature-slug>`

- **目的**: 詳細な計画ドキュメントを作成
- **前提**: Research で GO 判定済み
- **出力**: `rpi/{feature-slug}/plan/` 配下に pm.md, ux.md, eng.md, PLAN.md

### `/rpi:implement <feature-slug>`

- **目的**: フェーズ別の実装とバリデーションゲート
- **前提**: PLAN.md が存在
- **オプション**: `--phase N`（特定フェーズ）, `--validate-only`（検証のみ）

---

## 引数の受け渡し

Commands 内で `$ARGUMENTS` を使用して、ユーザーの入力を受け取れる:

```markdown
## User Input

\```text
$ARGUMENTS
\```

You **MUST** parse the user input to extract the feature slug.
```

---

## Post-Completion Action パターン

リポジトリのすべての RPI コマンドに共通する終了時の指示:

```markdown
## Post-Completion Action

**IMPORTANT**: After completing the workflow, ALWAYS prompt
the user to compact the conversation:

> **Context Management**: This workflow consumed significant context.
> Please run `/compact` to free up space.
```

大きなワークフロー完了後はコンテキストを大量に消費しているため、手動 `/compact` を促す設計になっている。

---

## ベストプラクティス

1. **Command はエントリーポイントに特化** — 複雑なロジックは Agent に委譲
2. **エラーハンドリングを明記** — 前提条件が満たされない場合の処理を定義
3. **Completion Report を定義** — 完了時に何を報告するか明確に
4. **`/compact` 促進** — 大きなワークフロー後はコンテキスト管理を促す
5. **サブディレクトリで名前空間を整理** — `rpi/research`, `rpi/plan` のようにグループ化
